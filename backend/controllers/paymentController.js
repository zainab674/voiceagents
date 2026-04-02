import Stripe from 'stripe';
import { supabase } from '#lib/supabase.js';

/**
 * Get Stripe instance for a specific tenant/user
 * @param {string} tenantSlug - The slug of the tenant admin
 * @returns {Promise<Stripe>} Stripe instance configured with the correct key
 */
const getStripeForTenant = async (tenantSlug) => {
    if (!tenantSlug || tenantSlug === 'main') {
        // Return main admin Stripe
        // Look for admin user with tenant='main' or slug_name='main'
        const { data: mainAdmin } = await supabase
            .from('users')
            .select('stripe_secret_key')
            .eq('role', 'admin')
            .or('slug_name.eq.main,tenant.eq.main,and(slug_name.is.null,tenant.eq.main)')
            .limit(1)
            .maybeSingle();

        const key = mainAdmin?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
        if (!key) {
            console.error('❌ No Stripe key found for main tenant. Checked:', {
                mainAdminFound: !!mainAdmin,
                hasStripeKey: !!mainAdmin?.stripe_secret_key,
                hasEnvKey: !!process.env.STRIPE_SECRET_KEY
            });
            throw new Error('Main Stripe configuration missing');
        }
        return new Stripe(key);
    }

    // Fetch Whitelabel Admin's key
    const { data: admin } = await supabase
        .from('users')
        .select('stripe_secret_key')
        .eq('slug_name', tenantSlug)
        .eq('is_whitelabel', true)
        .eq('role', 'admin')
        .single();

    if (!admin || !admin.stripe_secret_key) {
        throw new Error(`Stripe configuration missing for tenant: ${tenantSlug}`);
    }

    return new Stripe(admin.stripe_secret_key);
};

export const activateUserAfterPayment = async (req, res) => {
    try {
        const { sessionId, tenant } = req.body;

        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Session ID is required' });
        }

        // Retrieve the Stripe session using the correct tenant's key
        const stripe = await getStripeForTenant(tenant || 'main');
        let session;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId);
        } catch (err) {
            console.error('❌ Failed to retrieve Stripe session:', err.message);
            return res.status(400).json({ success: false, message: 'Invalid or expired payment session' });
        }

        if (session.payment_status !== 'paid') {
            return res.status(402).json({
                success: false,
                message: 'Payment not completed for this session'
            });
        }

        const userId = session.metadata?.userId;

        if (!userId || userId === 'new_user') {
            return res.status(400).json({
                success: false,
                message: 'No user associated with this payment session'
            });
        }

        // Activate the user account
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({ status: 'Active' })
            .eq('id', userId)
            .eq('status', 'pending_payment')
            .select()
            .single();

        if (error) {
            console.error('❌ Error activating user:', error);
            return res.status(500).json({ success: false, message: 'Failed to activate account' });
        }

        if (!updatedUser) {
            // User might already be active (e.g., webhook fired first or duplicate call)
            return res.status(200).json({
                success: true,
                message: 'Account is already active. Please sign in.'
            });
        }

        console.log('✅ User activated after payment:', userId);

        return res.status(200).json({
            success: true,
            message: 'Payment confirmed! Your account is now active. Please sign in.',
            data: {
                user: { id: updatedUser.id, email: updatedUser.email, status: updatedUser.status }
            }
        });

    } catch (error) {
        console.error('❌ Activate after payment error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const createCheckoutSession = async (req, res) => {
    try {
        const { planKey, successUrl, cancelUrl, customerEmail, userId } = req.body;

        if (!planKey || !successUrl || !cancelUrl) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: planKey, successUrl, cancelUrl'
            });
        }

        // 1. Fetch the Plan to get Stripe Price ID and Tenant
        console.log(`🔍 Looking for plan with planKey: "${planKey}"`);

        // Get tenant from request (for whitelabel domains)
        const requestTenant = req.tenant || 'main';
        console.log(`🏷️ Request tenant: "${requestTenant}"`);

        // Build query based on tenant
        let planQuery = supabase
            .from('plan_configs')
            .select('*')
            .eq('plan_key', planKey)
            .eq('is_active', true);

        // Filter by tenant
        if (requestTenant && requestTenant !== 'main') {
            // For whitelabel domains, look for tenant-specific plan first
            planQuery = planQuery.eq('tenant', requestTenant);
        } else {
            // For main domain, look for main tenant plans (tenant IS NULL)
            planQuery = planQuery.is('tenant', null);
        }

        const { data: plan, error: planError } = await planQuery.maybeSingle();

        console.log('📦 Plan lookup result:', { plan, planError, requestTenant });

        if (planError && planError.code !== 'PGRST116') {
            console.error('❌ Database error looking up plan:', { planKey, planError });
            return res.status(500).json({ success: false, message: 'Error looking up plan' });
        }

        if (!plan) {
            console.error('❌ Plan not found:', { planKey, requestTenant });
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        if (!plan.stripe_price_id) {
            console.error('❌ Plan missing Stripe Price ID:', { planKey, plan });
            return res.status(400).json({
                success: false,
                message: 'This plan is not configured for payments (missing Stripe Price ID)'
            });
        }

        // 2. Identify Plan Owner (Tenant)
        const planTenant = plan.tenant || 'main';
        console.log(`💳 Creating checkout for plan "${plan.name}" (Tenant: ${planTenant})`);

        // 3. Initialize dynamic Stripe instance
        const stripe = await getStripeForTenant(planTenant);

        // 4. Create Checkout Session
        const sessionConfig = {
            mode: 'subscription',
            line_items: [
                {
                    price: plan.stripe_price_id,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                planKey: planKey,
                tenant: planTenant,
                userId: userId || 'new_user' // 'new_user' if currently signing up
            }
        };

        if (customerEmail) {
            sessionConfig.customer_email = customerEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.json({
            success: true,
            url: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('❌ Create Checkout Session Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to initiate checkout'
        });
    }
};

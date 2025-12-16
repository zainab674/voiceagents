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
        // For main admin, we might use env var or DB. Assuming DB for consistency if implemented, 
        // but usually main admin key is in env. Let's support both or check DB first.
        // For now, let's look up the 'main' user in DB or fall back to process.env.STRIPE_SECRET_KEY
        const { data: mainAdmin } = await supabase
            .from('users')
            .select('stripe_secret_key')
            .eq('slug_name', 'main')
            .single();

        const key = mainAdmin?.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('Main Stripe configuration missing');
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
        const { data: plan, error: planError } = await supabase
            .from('plan_configs')
            .select('*')
            .eq('plan_key', planKey)
            .single();

        console.log('📦 Plan lookup result:', { plan, planError });

        if (planError || !plan) {
            console.error('❌ Plan not found:', { planKey, planError });
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        if (!plan.stripe_price_id) {
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

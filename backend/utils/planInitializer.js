/**
 * Plan Initializer Utility
 * Creates default plans for whitelabel admins when they register
 */
import { supabase } from '#lib/supabase.js';

const DEFAULT_PLANS = [
  {
    plan_key: 'starter',
    name: 'Starter',
    price: 29,
    minutes_limit: 1000,
    features: [
      '1,000 minutes/month',
      'Basic AI agents',
      'Email support',
      'Call analytics'
    ],
    display_order: 1
  },
  {
    plan_key: 'professional',
    name: 'Professional',
    price: 99,
    minutes_limit: 5000,
    features: [
      '5,000 minutes/month',
      'Advanced AI agents',
      'Priority support',
      'Advanced analytics',
      'CRM integration'
    ],
    display_order: 2
  },
  {
    plan_key: 'enterprise',
    name: 'Enterprise',
    price: 299,
    minutes_limit: 20000,
    features: [
      '20,000 minutes/month',
      'Custom AI agents',
      '24/7 support',
      'Enterprise analytics',
      'Full CRM integration',
      'Custom integrations'
    ],
    display_order: 3
  },
  {
    plan_key: 'unlimited',
    name: 'Unlimited',
    price: 999,
    minutes_limit: 0, // 0 means unlimited
    features: [
      'Unlimited minutes',
      'Custom AI agents',
      'Dedicated support',
      'Enterprise analytics',
      'Full CRM integration',
      'Custom integrations',
      'White label options'
    ],
    display_order: 4
  }
];

/**
 * Initialize default plans for a whitelabel admin
 * @param {string} tenantSlug - The slug_name of the whitelabel admin
 * @returns {Promise<{success: boolean, created: number, skipped: number, errors: Array}>}
 */
export async function initializePlansForTenant(tenantSlug) {
  if (!tenantSlug || tenantSlug === 'main') {
    console.warn('⚠️ Cannot initialize plans for main tenant or invalid slug');
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: ['Invalid tenant slug']
    };
  }

  try {
    console.log(`🌱 Initializing default plans for whitelabel tenant: ${tenantSlug}`);

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const plan of DEFAULT_PLANS) {
      // Check if plan already exists for this tenant
      const { data: existing } = await supabase
        .from('plan_configs')
        .select('id')
        .eq('plan_key', plan.plan_key)
        .eq('tenant', tenantSlug)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️  Plan ${plan.plan_key} already exists for tenant ${tenantSlug}, skipping...`);
        skipped++;
        continue;
      }

      // Insert plan with tenant
      const planData = {
        ...plan,
        tenant: tenantSlug,
        is_active: true
      };

      const { data, error } = await supabase
        .from('plan_configs')
        .insert(planData)
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating plan ${plan.plan_key} for tenant ${tenantSlug}:`, error);
        errors.push({ plan_key: plan.plan_key, error: error.message });
        continue;
      }

      console.log(`✅ Created plan: ${plan.name} (${plan.plan_key}) for tenant ${tenantSlug}`);
      created++;
    }

    console.log(`✅ Plan initialization completed for tenant ${tenantSlug}: ${created} created, ${skipped} skipped`);

    return {
      success: errors.length === 0,
      created,
      skipped,
      errors
    };
  } catch (error) {
    console.error(`❌ Error initializing plans for tenant ${tenantSlug}:`, error);
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
}

/**
 * Initialize default plans for main tenant (if they don't exist)
 * @returns {Promise<{success: boolean, created: number, skipped: number, errors: Array}>}
 */
export async function initializeMainTenantPlans() {
  try {
    console.log('🌱 Initializing default plans for main tenant...');

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const plan of DEFAULT_PLANS) {
      // Check if plan already exists for main tenant (tenant IS NULL)
      const { data: existing } = await supabase
        .from('plan_configs')
        .select('id')
        .eq('plan_key', plan.plan_key)
        .is('tenant', null)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️  Plan ${plan.plan_key} already exists for main tenant, skipping...`);
        skipped++;
        continue;
      }

      // Insert plan with tenant = null (main tenant)
      const planData = {
        ...plan,
        tenant: null,
        is_active: true
      };

      const { data, error } = await supabase
        .from('plan_configs')
        .insert(planData)
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating plan ${plan.plan_key} for main tenant:`, error);
        errors.push({ plan_key: plan.plan_key, error: error.message });
        continue;
      }

      console.log(`✅ Created plan: ${plan.name} (${plan.plan_key}) for main tenant`);
      created++;
    }

    console.log(`✅ Plan initialization completed for main tenant: ${created} created, ${skipped} skipped`);

    return {
      success: errors.length === 0,
      created,
      skipped,
      errors
    };
  } catch (error) {
    console.error('❌ Error initializing plans for main tenant:', error);
    return {
      success: false,
      created: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
}



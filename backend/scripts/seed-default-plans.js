/**
 * Seed default plan configurations
 * Run this after database migration to populate initial plans
 */
import { supabase } from '../lib/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

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
    tenant: null, // Main tenant plan
    is_active: true,
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
    tenant: null,
    is_active: true,
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
    tenant: null,
    is_active: true,
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
    tenant: null,
    is_active: true,
    display_order: 4
  }
];

async function seedPlans() {
  try {
    console.log('🌱 Seeding default plan configurations...');

    for (const plan of DEFAULT_PLANS) {
      // Check if plan already exists
      const { data: existing } = await supabase
        .from('plan_configs')
        .select('id')
        .eq('plan_key', plan.plan_key)
        .is('tenant', null)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️  Plan ${plan.plan_key} already exists, skipping...`);
        continue;
      }

      // Insert plan
      const { data, error } = await supabase
        .from('plan_configs')
        .insert(plan)
        .select()
        .single();

      if (error) {
        console.error(`❌ Error seeding plan ${plan.plan_key}:`, error);
        continue;
      }

      console.log(`✅ Seeded plan: ${plan.name} (${plan.plan_key})`);
    }

    console.log('✅ Plan seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlans();
}

export { seedPlans };


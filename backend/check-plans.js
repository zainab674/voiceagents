/**
 * Quick diagnostic script to check plan configuration
 * Run this to see what's in your production database
 */

import { supabase } from './lib/supabase.js';

async function checkPlans() {
    console.log('🔍 Checking all plans in database...\n');

    // Get all plans
    const { data: allPlans, error } = await supabase
        .from('plan_configs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching plans:', error);
        return;
    }

    console.log(`📊 Total plans found: ${allPlans?.length || 0}\n`);

    if (allPlans && allPlans.length > 0) {
        allPlans.forEach((plan, index) => {
            console.log(`\n--- Plan ${index + 1} ---`);
            console.log(`Plan Key: ${plan.plan_key}`);
            console.log(`Name: ${plan.name}`);
            console.log(`Price: $${plan.price}`);
            console.log(`Minutes: ${plan.minutes_limit === 0 ? 'Unlimited' : plan.minutes_limit}`);
            console.log(`Tenant: ${plan.tenant || 'main (null)'}`);
            console.log(`Active: ${plan.is_active}`);
            console.log(`Stripe Price ID: ${plan.stripe_price_id || '❌ MISSING'}`);
            console.log(`Stripe Product ID: ${plan.stripe_product_id || 'Not set'}`);
            console.log(`Created: ${plan.created_at}`);
            console.log(`Updated: ${plan.updated_at}`);
        });
    } else {
        console.log('⚠️ No plans found in database!');
    }

    // Check for specific plan
    console.log('\n\n🔍 Checking for "starter" plan specifically...\n');

    const { data: starterPlan, error: starterError } = await supabase
        .from('plan_configs')
        .select('*')
        .eq('plan_key', 'starter')
        .is('tenant', null);

    if (starterError) {
        console.error('❌ Error fetching starter plan:', starterError);
    } else if (starterPlan && starterPlan.length > 0) {
        console.log('✅ Starter plan found:');
        console.log(JSON.stringify(starterPlan[0], null, 2));
    } else {
        console.log('❌ No "starter" plan found with tenant=null');
    }

    process.exit(0);
}

checkPlans().catch(console.error);

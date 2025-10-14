#!/usr/bin/env node
/**
 * Fix existing SIP dispatch rules to use correct 'did-' room prefix
 * This script updates previously assigned phone numbers to work with the corrected configuration
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { listDispatchRules, cleanupDispatchRules } from './backend/services/livekitSipService.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixExistingDispatchRules() {
  console.log('🔧 Fixing Existing SIP Dispatch Rules');
  console.log('====================================');
  console.log('This will update previously assigned phone numbers to use the correct "did-" room prefix');
  console.log('');

  try {
    // 1. Check current dispatch rules
    console.log('1. Checking current dispatch rules...');
    const rulesResult = await listDispatchRules();
    
    if (!rulesResult.success) {
      console.log(`❌ Failed to list dispatch rules: ${rulesResult.message}`);
      return;
    }

    const rules = rulesResult.rules;
    console.log(`   Found ${rules.length} dispatch rules`);

    // 2. Identify rules that need fixing
    const rulesToFix = rules.filter(rule => {
      const roomPrefix = rule.roomPrefix;
      return roomPrefix && roomPrefix !== 'did-';
    });

    if (rulesToFix.length === 0) {
      console.log('   ✅ All dispatch rules already use correct "did-" prefix');
      console.log('   No fixes needed!');
      return;
    }

    console.log(`   ⚠️  Found ${rulesToFix.length} rules with incorrect room prefix:`);
    rulesToFix.forEach(rule => {
      console.log(`      📋 ${rule.name || 'unnamed'} - Prefix: "${rule.roomPrefix}"`);
    });

    // 3. Get phone numbers that need reassignment
    console.log('\n2. Checking phone number assignments...');
    const { data: phoneNumbers, error } = await supabase
      .from('phone_number')
      .select('number, inbound_assistant_id, status')
      .eq('status', 'active');

    if (error) {
      console.log(`❌ Error fetching phone numbers: ${error.message}`);
      return;
    }

    if (!phoneNumbers || phoneNumbers.length === 0) {
      console.log('   ⚠️  No active phone numbers found');
      return;
    }

    console.log(`   Found ${phoneNumbers.length} active phone numbers`);

    // 4. Clean up old dispatch rules
    console.log('\n3. Cleaning up old dispatch rules...');
    const cleanupResult = await cleanupDispatchRules();
    
    if (cleanupResult.success) {
      console.log(`   ✅ Cleanup complete: Deleted ${cleanupResult.deletedCount} rules, kept ${cleanupResult.keptCount} rules`);
    } else {
      console.log(`   ❌ Cleanup failed: ${cleanupResult.message}`);
      return;
    }

    // 5. Instructions for reassignment
    console.log('\n4. Next Steps:');
    console.log('   📋 To fix previously assigned phone numbers:');
    console.log('   1. Go to your frontend application');
    console.log('   2. Find the phone numbers that were previously assigned');
    console.log('   3. Reassign them to their assistants (this will create new rules with "did-" prefix)');
    console.log('   4. The reassignment process will:');
    console.log('      - Keep the existing SIP trunk');
    console.log('      - Delete old dispatch rules');
    console.log('      - Create new dispatch rules with "did-" prefix');
    console.log('      - Update the phone number mapping');

    console.log('\n💡 Alternative: Manual Fix');
    console.log('   If you prefer, you can also:');
    console.log('   1. Unassign the phone numbers first');
    console.log('   2. Then reassign them to the same assistants');
    console.log('   3. This will trigger the creation of new, correct dispatch rules');

    console.log('\n🎯 Why This Is Needed:');
    console.log('   - Previously assigned numbers have dispatch rules with "assistant-" prefix');
    console.log('   - The LiveKit agent now looks for "did-" prefixed rooms');
    console.log('   - Without fixing, calls will still disconnect');
    console.log('   - Reassignment creates new rules with the correct prefix');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Run the fix
fixExistingDispatchRules().catch(console.error);

#!/usr/bin/env node
/**
 * Test script to verify SIP dispatch rules are working correctly
 * This tests the corrected SIP approach: Twilio → LiveKit SIP → AI Agent
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { listDispatchRules, listInboundTrunks } from './backend/services/livekitSipService.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSipDispatchRules() {
  console.log('🧪 Testing SIP Dispatch Rules Configuration');
  console.log('==========================================');
  console.log('This tests the corrected SIP approach: Twilio → LiveKit SIP → AI Agent');
  console.log('');

  try {
    // 1. Check environment variables
    console.log('1. Environment Variables:');
    const requiredEnvVars = [
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY', 
      'LIVEKIT_API_SECRET',
      'LIVEKIT_SIP_DOMAIN',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    let envOk = true;
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`   ✅ ${envVar}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`   ❌ ${envVar}: NOT SET`);
        envOk = false;
      }
    }

    if (!envOk) {
      console.log('\n❌ Missing required environment variables');
      return;
    }

    // 2. Check LiveKit SIP trunks
    console.log('\n2. LiveKit SIP Trunks:');
    const trunksResult = await listInboundTrunks();
    if (trunksResult.success) {
      console.log(`   ✅ Found ${trunksResult.trunks.length} SIP trunks:`);
      trunksResult.trunks.forEach(trunk => {
        const numbers = trunk.numbers || [];
        console.log(`      📞 ${trunk.name} (${trunk.sipTrunkId}) - Numbers: ${numbers.join(', ') || 'none'}`);
      });
    } else {
      console.log(`   ❌ Failed to list trunks: ${trunksResult.message}`);
    }

    // 3. Check SIP dispatch rules
    console.log('\n3. SIP Dispatch Rules:');
    const rulesResult = await listDispatchRules();
    if (rulesResult.success) {
      console.log(`   ✅ Found ${rulesResult.rules.length} dispatch rules:`);
      rulesResult.rules.forEach(rule => {
        const inboundNumbers = rule.inbound_numbers || rule.inboundNumbers || [];
        const trunkIds = rule.trunk_ids || rule.trunkIds || [];
        const agents = rule.roomConfig?.agents || [];
        
        console.log(`      📋 ${rule.name || 'unnamed'}`);
        console.log(`         Room Prefix: ${rule.roomPrefix || 'none'}`);
        console.log(`         Trunk IDs: ${trunkIds.join(', ') || 'all'}`);
        console.log(`         Inbound Numbers: ${inboundNumbers.join(', ') || 'all'}`);
        console.log(`         Agents: ${agents.length}`);
        
        // Check if this rule uses the correct 'did-' prefix
        if (rule.roomPrefix === 'did-') {
          console.log(`         ✅ Uses correct 'did-' room prefix`);
        } else {
          console.log(`         ⚠️  Uses '${rule.roomPrefix}' prefix (should be 'did-')`);
        }
      });
    } else {
      console.log(`   ❌ Failed to list dispatch rules: ${rulesResult.message}`);
    }

    // 4. Check phone number assignments
    console.log('\n4. Phone Number Assignments:');
    try {
      const { data: phoneNumbers, error } = await supabase
        .from('phone_number')
        .select('number, inbound_assistant_id, inbound_trunk_id, status')
        .eq('status', 'active');

      if (error) {
        console.log(`   ❌ Error fetching phone numbers: ${error.message}`);
      } else if (phoneNumbers && phoneNumbers.length > 0) {
        console.log(`   ✅ Found ${phoneNumbers.length} active phone numbers:`);
        phoneNumbers.forEach(pn => {
          console.log(`      📞 ${pn.number} → Assistant: ${pn.inbound_assistant_id} → Trunk: ${pn.inbound_trunk_id}`);
        });
      } else {
        console.log('   ⚠️  No active phone numbers found');
        console.log('   💡 Assign phone numbers to assistants first');
      }
    } catch (error) {
      console.log(`   ❌ Database error: ${error.message}`);
    }

    // 5. Test webhook URL
    console.log('\n5. Webhook Configuration:');
    const ngrokUrl = process.env.NGROK_URL;
    if (ngrokUrl) {
      console.log(`   ✅ Ngrok URL: ${ngrokUrl}`);
      console.log(`   📞 Voice Webhook: ${ngrokUrl}/api/v1/twilio/voice`);
      
      // Test webhook endpoint
      try {
        const response = await fetch(`${ngrokUrl}/health`);
        if (response.ok) {
          console.log('   ✅ Backend server is reachable');
        } else {
          console.log(`   ⚠️  Backend server returned: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Cannot reach backend server: ${error.message}`);
      }
    } else {
      console.log('   ❌ Ngrok URL not configured');
      console.log('   💡 Start ngrok tunnel or set NGROK_URL');
    }

    // 6. Summary and next steps
    console.log('\n6. Summary:');
    console.log('   📋 The corrected SIP approach should work as follows:');
    console.log('   1. Twilio receives incoming call');
    console.log('   2. Twilio webhook connects to LiveKit SIP');
    console.log('   3. LiveKit SIP dispatch rules route to room with "did-" prefix');
    console.log('   4. AI agent joins the room and handles the call');
    
    console.log('\n🔧 If calls still disconnect:');
    console.log('   1. Check that SIP dispatch rules use "did-" room prefix');
    console.log('   2. Verify phone numbers are attached to SIP trunks');
    console.log('   3. Check LiveKit agent logs for room creation');
    console.log('   4. Ensure LIVEKIT_SIP_DOMAIN is correctly configured');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSipDispatchRules().catch(console.error);

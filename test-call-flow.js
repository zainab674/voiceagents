#!/usr/bin/env node
/**
 * Test script to verify call flow configuration
 * Run this after making changes to test the complete setup
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCallFlow() {
  console.log('🧪 Testing Call Flow Configuration');
  console.log('================================\n');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  const requiredEnvVars = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY', 
    'LIVEKIT_API_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NGROK_URL'
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

  // 2. Check LiveKit SIP configuration
  console.log('\n2. LiveKit SIP Configuration:');
  const livekitSipDomain = process.env.LIVEKIT_SIP_DOMAIN || 
    process.env.LIVEKIT_HOST?.replace('wss://', '').replace('ws://', '');
  
  if (livekitSipDomain) {
    console.log(`   ✅ LiveKit SIP Domain: ${livekitSipDomain}`);
  } else {
    console.log('   ❌ LiveKit SIP Domain: NOT CONFIGURED');
    console.log('   💡 Set LIVEKIT_SIP_DOMAIN in your .env file');
  }

  // 3. Check phone number assignments
  console.log('\n3. Phone Number Assignments:');
  try {
    const { data: phoneNumbers, error } = await supabase
      .from('phone_number')
      .select('number, inbound_assistant_id, status')
      .eq('status', 'active');

    if (error) {
      console.log(`   ❌ Error fetching phone numbers: ${error.message}`);
    } else if (phoneNumbers && phoneNumbers.length > 0) {
      console.log(`   ✅ Found ${phoneNumbers.length} active phone numbers:`);
      phoneNumbers.forEach(pn => {
        console.log(`      📞 ${pn.number} → Assistant: ${pn.inbound_assistant_id}`);
      });
    } else {
      console.log('   ⚠️  No active phone numbers found');
      console.log('   💡 Assign phone numbers to assistants first');
    }
  } catch (error) {
    console.log(`   ❌ Database error: ${error.message}`);
  }

  // 4. Check agents
  console.log('\n4. AI Agents:');
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, prompt');

    if (error) {
      console.log(`   ❌ Error fetching agents: ${error.message}`);
    } else if (agents && agents.length > 0) {
      console.log(`   ✅ Found ${agents.length} agents:`);
      agents.forEach(agent => {
        console.log(`      🤖 ${agent.name} (${agent.id})`);
      });
    } else {
      console.log('   ⚠️  No agents found');
      console.log('   💡 Create agents first');
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
    console.log(`   📹 Recording Webhook: ${ngrokUrl}/api/v1/recording/webhook`);
    
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
  console.log('\n6. Next Steps:');
  console.log('   📋 To test the call flow:');
  console.log('   1. Make sure ngrok is running');
  console.log('   2. Assign a phone number to an assistant');
  console.log('   3. Call the assigned phone number');
  console.log('   4. Check LiveKit logs for room creation');
  console.log('   5. Check backend logs for webhook calls');
  
  console.log('\n🔧 If calls still disconnect:');
  console.log('   1. Check Twilio console for webhook errors');
  console.log('   2. Verify LiveKit SIP domain configuration');
  console.log('   3. Check LiveKit agent logs');
  console.log('   4. Ensure phone number is properly assigned to trunk');
}

// Run the test
testCallFlow().catch(console.error);

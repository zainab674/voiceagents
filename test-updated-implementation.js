#!/usr/bin/env node
/**
 * Test script to verify the updated LiveKit implementation
 * Run this after implementing the missing components
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdatedImplementation() {
  console.log('🧪 Testing Updated LiveKit Implementation');
  console.log('==========================================\n');

  // 1. Check environment variables
  console.log('1. Environment Variables:');
  const requiredEnvVars = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY', 
    'LIVEKIT_API_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY'
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

  // 2. Test database schema compatibility
  console.log('\n2. Database Schema Test:');
  try {
    // Test agents table
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, instructions')
      .limit(1);

    if (agentsError) {
      console.log(`   ❌ Agents table error: ${agentsError.message}`);
    } else {
      console.log(`   ✅ Agents table accessible (${agents?.length || 0} records)`);
    }

    // Test phone_number table
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_number')
      .select('number, inbound_assistant_id')
      .limit(1);

    if (phoneError) {
      console.log(`   ❌ Phone number table error: ${phoneError.message}`);
    } else {
      console.log(`   ✅ Phone number table accessible (${phoneNumbers?.length || 0} records)`);
    }

  } catch (error) {
    console.log(`   ❌ Database connection error: ${error.message}`);
  }

  // 3. Check file structure
  console.log('\n3. File Structure Check:');
  const requiredFiles = [
    'livekit/main.py',
    'livekit/core/call_processor.py',
    'livekit/core/inbound_handler.py',
    'livekit/core/outbound_handler.py',
    'livekit/config/settings.py',
    'livekit/services/rag_assistant.py',
    'livekit/utils/logging_config.py',
    'livekit/requirements_enhanced.txt'
  ];

  let filesOk = true;
  for (const file of requiredFiles) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} - MISSING`);
        filesOk = false;
      }
    } catch (error) {
      console.log(`   ⚠️  ${file} - Could not check`);
    }
  }

  // 4. Summary and next steps
  console.log('\n4. Next Steps:');
  if (envOk && filesOk) {
    console.log('   ✅ Implementation looks complete!');
    console.log('   📋 To test:');
    console.log('   1. Install dependencies: cd livekit && pip install -r requirements_enhanced.txt');
    console.log('   2. Start the agent: python main.py');
    console.log('   3. Make a test call to verify it works');
  } else {
    console.log('   ⚠️  Some issues found - please fix them before testing');
  }
  
  console.log('\n🔧 If calls still don\'t work:');
  console.log('   1. Check LiveKit agent logs for errors');
  console.log('   2. Verify SIP dispatch rules are created');
  console.log('   3. Ensure phone numbers are assigned to assistants');
  console.log('   4. Check Twilio webhook configuration');
}

// Run the test
testUpdatedImplementation().catch(console.error);

// test-outbound-integration.js
// Test script to verify outbound calls integration

import { outboundCallsService } from './services/outbound-calls-service.js';
import { livekitOutboundService } from './services/livekit-outbound-service.js';
import { campaignEngine } from './services/campaign-execution-engine.js';
import 'dotenv/config';

async function testOutboundIntegration() {
  console.log('🧪 Testing Outbound Calls Integration...\n');

  try {
    console.log('1. Testing service initialization...');
    console.log('   ✅ OutboundCallsService loaded successfully');
    console.log('   ✅ LiveKitOutboundService loaded successfully');
    console.log('   ✅ CampaignExecutionEngine loaded successfully');

    console.log('\n2. Testing environment configuration...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'LIVEKIT_HOST',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('   ⚠️  Missing environment variables:', missingVars.join(', '));
      console.log('   💡 Please set these in your .env file');
    } else {
      console.log('   ✅ All required environment variables found');
    }

    console.log('\n3. Testing LiveKit outbound service...');
    try {
      const trunksResult = await livekitOutboundService.listOutboundTrunks();
      if (trunksResult.success) {
        console.log(`   ✅ LiveKit connection working - found ${trunksResult.trunks.length} outbound trunks`);
      } else {
        console.log('   ⚠️  LiveKit connection issue:', trunksResult.message);
      }
    } catch (error) {
      console.log('   ❌ LiveKit connection failed:', error.message);
    }

    console.log('\n4. Testing campaign execution engine...');
    try {
      console.log('   🔄 Starting campaign engine...');
      campaignEngine.start();
      console.log('   ✅ Campaign execution engine started');
      
      // Stop it after a moment
      setTimeout(() => {
        campaignEngine.stop();
        console.log('   ✅ Campaign execution engine stopped');
      }, 2000);
    } catch (error) {
      console.log('   ❌ Campaign engine failed:', error.message);
    }

    console.log('\n5. Testing database schema...');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test campaigns table
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id')
        .limit(1);

      if (campaignsError) {
        console.log('   ❌ Campaigns table error:', campaignsError.message);
        console.log('   💡 Run the database schema migration first');
      } else {
        console.log('   ✅ Campaigns table accessible');
      }

      // Test campaign_calls table
      const { data: calls, error: callsError } = await supabase
        .from('campaign_calls')
        .select('id')
        .limit(1);

      if (callsError) {
        console.log('   ❌ Campaign_calls table error:', callsError.message);
        console.log('   💡 Run the database schema migration first');
      } else {
        console.log('   ✅ Campaign_calls table accessible');
      }

    } catch (error) {
      console.log('   ❌ Database test failed:', error.message);
    }

    console.log('\n6. Testing API endpoints...');
    const baseUrl = process.env.BACKEND_URL || process.env.NGROK_URL || 'http://localhost:4000';
    
    const endpoints = [
      '/api/v1/outbound-calls/initiate',
      '/api/v1/outbound-calls/status-callback',
      '/api/v1/livekit/outbound-calls/trunks',
      '/api/v1/campaigns'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 401) {
          console.log(`   ✅ ${endpoint} - Authentication required (expected)`);
        } else if (response.status === 200) {
          console.log(`   ✅ ${endpoint} - Accessible`);
        } else {
          console.log(`   ⚠️  ${endpoint} - Status: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint} - Error: ${error.message}`);
      }
    }

    console.log('\n✅ Outbound calls integration test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the database schema migration:');
    console.log('   - Execute create-outbound-calls-schema.sql in Supabase');
    console.log('2. Set up LiveKit outbound trunks for your assistants');
    console.log('3. Create campaigns and test outbound calling');
    console.log('4. Configure Twilio webhooks for call status updates');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testOutboundIntegration();

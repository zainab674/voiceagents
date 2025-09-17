// test-sms-webhook-config.js
// Test script to verify SMS webhook configuration when assigning phone numbers

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

async function testSMSWebhookConfig() {
  console.log('🧪 Testing SMS Webhook Configuration...\n');

  // Initialize services
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    console.log('1. Testing webhook URL generation...');
    const baseUrl = process.env.BACKEND_URL || process.env.NGROK_URL || 'http://localhost:4000';
    const smsWebhookUrl = `${baseUrl}/api/v1/sms/webhook`;
    console.log(`✅ SMS Webhook URL: ${smsWebhookUrl}`);

    console.log('\n2. Testing Twilio phone number list...');
    const phoneNumbers = await twilioClient.incomingPhoneNumbers.list({ limit: 5 });
    console.log(`✅ Found ${phoneNumbers.length} phone numbers`);

    if (phoneNumbers.length > 0) {
      const testNumber = phoneNumbers[0];
      console.log(`📱 Testing with phone number: ${testNumber.phoneNumber} (SID: ${testNumber.sid})`);
      
      console.log('\n3. Current SMS webhook configuration:');
      console.log(`   SMS URL: ${testNumber.smsUrl || 'Not configured'}`);
      console.log(`   SMS Method: ${testNumber.smsMethod || 'Not configured'}`);

      console.log('\n4. Testing SMS webhook configuration...');
      try {
        await twilioClient.incomingPhoneNumbers(testNumber.sid).update({
          smsUrl: smsWebhookUrl,
          smsMethod: 'POST'
        });
        console.log('✅ SMS webhook configured successfully!');
        
        // Verify the configuration
        const updatedNumber = await twilioClient.incomingPhoneNumbers(testNumber.sid).fetch();
        console.log('\n5. Verification:');
        console.log(`   SMS URL: ${updatedNumber.smsUrl}`);
        console.log(`   SMS Method: ${updatedNumber.smsMethod}`);
        
        if (updatedNumber.smsUrl === smsWebhookUrl && updatedNumber.smsMethod === 'POST') {
          console.log('✅ SMS webhook configuration verified!');
        } else {
          console.log('❌ SMS webhook configuration verification failed');
        }
        
      } catch (webhookError) {
        console.error('❌ Failed to configure SMS webhook:', webhookError.message);
      }
    } else {
      console.log('ℹ️  No phone numbers found to test with');
    }

    console.log('\n✅ SMS Webhook Configuration test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Assign a phone number to an assistant');
    console.log('2. Check that SMS webhook is automatically configured');
    console.log('3. Test incoming SMS to verify webhook is working');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSMSWebhookConfig();


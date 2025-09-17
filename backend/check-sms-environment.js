// check-sms-environment.js
// Check SMS environment configuration and ngrok status

import 'dotenv/config';

function checkSMSEnvironment() {
  console.log('🔍 Checking SMS Environment Configuration...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   NGROK_URL: ${process.env.NGROK_URL || '❌ Not set'}`);
  console.log(`   BACKEND_URL: ${process.env.BACKEND_URL || '❌ Not set'}`);
  console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Not set'}`);
  console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set'}`);

  // Determine webhook URL priority
  console.log('\n🌐 Webhook URL Configuration:');
  const ngrokUrl = process.env.NGROK_URL;
  const backendUrl = process.env.BACKEND_URL;
  const localhostUrl = 'http://localhost:4000';

  let webhookUrl;
  let source;
  
  if (ngrokUrl) {
    webhookUrl = `${ngrokUrl}/api/v1/sms/webhook`;
    source = 'ngrok (development)';
  } else if (backendUrl) {
    webhookUrl = `${backendUrl}/api/v1/sms/webhook`;
    source = 'backend URL (production)';
  } else {
    webhookUrl = `${localhostUrl}/api/v1/sms/webhook`;
    source = 'localhost (fallback)';
  }

  console.log(`   Webhook URL: ${webhookUrl}`);
  console.log(`   Source: ${source}`);

  // Check if ngrok is running
  console.log('\n🚀 Ngrok Status:');
  if (ngrokUrl) {
    console.log('   ✅ Ngrok URL is configured');
    console.log(`   📡 Ngrok URL: ${ngrokUrl}`);
    
    // Test if ngrok URL is accessible
    fetch(ngrokUrl)
      .then(response => {
        if (response.ok) {
          console.log('   ✅ Ngrok tunnel is active and accessible');
        } else {
          console.log(`   ⚠️  Ngrok tunnel responded with status: ${response.status}`);
        }
      })
      .catch(error => {
        console.log('   ❌ Ngrok tunnel is not accessible:', error.message);
        console.log('   💡 Make sure ngrok is running: ngrok http 4000');
      });
  } else {
    console.log('   ❌ Ngrok URL not configured');
    console.log('   💡 To use ngrok for development:');
    console.log('      1. Install ngrok: https://ngrok.com/download');
    console.log('      2. Run: ngrok http 4000');
    console.log('      3. Set NGROK_URL environment variable to the ngrok URL');
  }

  // Frontend environment check
  console.log('\n🎨 Frontend Environment:');
  console.log('   VITE_NGROK_URL: Set in frontend .env file for ngrok support');
  console.log('   VITE_API_BASE_URL: Set in frontend .env file for production');

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (!ngrokUrl && !backendUrl) {
    console.log('   🔧 For development: Set up ngrok for SMS webhook testing');
    console.log('   🔧 For production: Set BACKEND_URL to your production domain');
  } else if (ngrokUrl) {
    console.log('   ✅ Development setup with ngrok is ready');
    console.log('   📱 SMS webhooks will use ngrok URL for testing');
  } else if (backendUrl) {
    console.log('   ✅ Production setup is ready');
    console.log('   📱 SMS webhooks will use production backend URL');
  }

  console.log('\n🧪 To test SMS functionality:');
  console.log('   1. Run: node test-complete-sms-integration.js');
  console.log('   2. Assign a phone number to an assistant');
  console.log('   3. Send SMS to that phone number');
  console.log('   4. Check webhook receives the SMS');
}

// Run the check
checkSMSEnvironment();


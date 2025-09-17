// test-ngrok-integration.js
// Test ngrok integration with NGROK_AUTHTOKEN

import 'dotenv/config';

async function testNgrokIntegration() {
  console.log('🧪 Testing ngrok integration...\n');

  // Check if NGROK_AUTHTOKEN is set
  if (!process.env.NGROK_AUTHTOKEN) {
    console.error('❌ NGROK_AUTHTOKEN environment variable is not set');
    console.log('💡 Please set NGROK_AUTHTOKEN in your .env file');
    return;
  }

  console.log('✅ NGROK_AUTHTOKEN found');
  console.log(`🔑 Auth Token: ${process.env.NGROK_AUTHTOKEN.substring(0, 8)}...`);

  try {
    // Import and connect to ngrok
    const { connect } = await import('@ngrok/ngrok');
    
    console.log('\n🌐 Starting ngrok tunnel...');
    const listener = await connect({
      addr: 4000,
      authtoken_from_env: true
    });

    const ngrokUrl = listener.url();
    console.log(`✅ ngrok tunnel established at: ${ngrokUrl}`);
    console.log(`📱 SMS Webhook URL: ${ngrokUrl}/api/v1/sms/webhook`);
    console.log(`📞 Status Callback URL: ${ngrokUrl}/api/v1/sms/status-callback`);

    // Test the webhook URL
    console.log('\n🧪 Testing webhook URL...');
    try {
      const response = await fetch(`${ngrokUrl}/api/v1/sms/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'test=1'
      });
      
      if (response.ok) {
        console.log('✅ Webhook URL is accessible');
      } else {
        console.log(`⚠️  Webhook URL responded with status: ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Webhook URL test failed:', error.message);
    }

    // Store the URL in environment
    process.env.NGROK_URL = ngrokUrl;
    console.log(`\n✅ NGROK_URL set to: ${ngrokUrl}`);

    console.log('\n📋 Next Steps:');
    console.log('1. Start your backend server: npm start');
    console.log('2. Assign a phone number to an assistant');
    console.log('3. Test SMS functionality');
    console.log('\n💡 Keep this terminal open to maintain the ngrok tunnel');

    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping ngrok tunnel...');
      listener.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start ngrok tunnel:', error.message);
    console.log('💡 Make sure:');
    console.log('   - NGROK_AUTHTOKEN is valid');
    console.log('   - Port 4000 is available');
    console.log('   - @ngrok/ngrok package is installed');
  }
}

// Run the test
testNgrokIntegration();
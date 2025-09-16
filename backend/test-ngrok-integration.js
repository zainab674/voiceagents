// test-ngrok-integration.js
// Test script to verify ngrok integration

import { ngrokService } from './services/ngrok-service.js';
import 'dotenv/config';

async function testNgrokIntegration() {
  console.log('🧪 Testing Ngrok Integration...\n');

  try {
    console.log('1. Testing ngrok service initialization...');
    console.log('   ✅ NgrokService class loaded successfully');

    console.log('\n2. Testing environment configuration...');
    const authToken = process.env.NGROK_AUTH_TOKEN;
    const region = process.env.NGROK_REGION || 'us';
    
    if (authToken) {
      console.log('   ✅ NGROK_AUTH_TOKEN found');
    } else {
      console.log('   ⚠️  NGROK_AUTH_TOKEN not found');
      console.log('   💡 Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken');
    }

    console.log(`   📍 Ngrok region: ${region}`);

    console.log('\n3. Testing URL caching...');
    const cachedUrl = ngrokService.loadUrlFromFile();
    if (cachedUrl) {
      console.log(`   ✅ Cached URL found: ${cachedUrl}`);
    } else {
      console.log('   ℹ️  No cached URL found (normal for first run)');
    }

    console.log('\n4. Testing webhook URL generation...');
    if (cachedUrl) {
      const webhookUrls = ngrokService.getWebhookUrls();
      if (webhookUrls) {
        console.log('   ✅ Webhook URLs generated:');
        console.log(`      SMS Webhook: ${webhookUrls.smsWebhook}`);
        console.log(`      Voice Webhook: ${webhookUrls.voiceWebhook}`);
        console.log(`      Status Callback: ${webhookUrls.statusCallback}`);
      }
    } else {
      console.log('   ℹ️  No ngrok URL available for webhook generation');
    }

    console.log('\n5. Testing ngrok tunnel start (if auth token available)...');
    if (authToken) {
      try {
        console.log('   🚀 Starting ngrok tunnel...');
        const url = await ngrokService.start();
        console.log(`   ✅ Ngrok tunnel started: ${url}`);
        
        // Display webhook instructions
        ngrokService.displayWebhookInstructions();
        
        // Test webhook URLs
        const webhookUrls = ngrokService.getWebhookUrls();
        if (webhookUrls) {
          console.log('\n6. Testing webhook endpoints...');
          
          // Test health check
          try {
            const healthResponse = await fetch(`${webhookUrls.base}/health`);
            if (healthResponse.ok) {
              console.log('   ✅ Health check endpoint working');
            } else {
              console.log('   ⚠️  Health check endpoint returned:', healthResponse.status);
            }
          } catch (error) {
            console.log('   ⚠️  Health check failed:', error.message);
          }
        }

        console.log('\n🛑 Stopping ngrok tunnel...');
        await ngrokService.stop();
        console.log('   ✅ Ngrok tunnel stopped');
        
      } catch (error) {
        console.log('   ❌ Failed to start ngrok tunnel:', error.message);
        console.log('   💡 Make sure your NGROK_AUTH_TOKEN is valid');
      }
    } else {
      console.log('   ⚠️  Skipping tunnel test (no auth token)');
    }

    console.log('\n✅ Ngrok integration test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Set NGROK_AUTH_TOKEN in your .env file');
    console.log('2. Run: npm run dev:ngrok');
    console.log('3. Configure Twilio webhooks with the ngrok URL');
    console.log('4. Test SMS and voice functionality');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testNgrokIntegration();

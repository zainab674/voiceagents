// test-sip-integration.js
// Simple test script to verify SIP integration functionality

import { createMainTrunkForUser, getSipConfigForLiveKit } from './services/twilio-trunk-service.js';

async function testSipIntegration() {
  console.log('🧪 Testing SIP Integration...\n');

  // Test data (replace with actual test credentials)
  const testData = {
    accountSid: process.env.TEST_TWILIO_ACCOUNT_SID || 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    authToken: process.env.TEST_TWILIO_AUTH_TOKEN || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    userId: 'test-user-123',
    label: 'test-integration'
  };

  try {
    console.log('1. Testing createMainTrunkForUser...');
    console.log('   This will create a real Twilio trunk with SIP configuration');
    console.log('   ⚠️  Make sure to set TEST_TWILIO_ACCOUNT_SID and TEST_TWILIO_AUTH_TOKEN env vars');
    console.log('   ⚠️  This will create actual Twilio resources and may incur costs\n');

    // Uncomment the following lines to test actual trunk creation
    // const trunkResult = await createMainTrunkForUser(testData);
    // console.log('✅ Trunk creation result:', {
    //   success: trunkResult.success,
    //   trunkSid: trunkResult.trunkSid,
    //   domainName: trunkResult.domainName,
    //   sipUsername: trunkResult.sipUsername,
    //   message: trunkResult.message
    // });

    console.log('2. Testing getSipConfigForLiveKit...');
    console.log('   This will retrieve SIP configuration from database');
    
    // This will fail if no credentials exist, which is expected
    try {
      const sipConfig = await getSipConfigForLiveKit(testData.userId);
      console.log('✅ SIP config retrieved:', {
        domainName: sipConfig.domainName,
        sipUsername: sipConfig.sipUsername,
        hasPassword: !!sipConfig.sipPassword,
        trunkSid: sipConfig.trunkSid
      });
    } catch (error) {
      console.log('ℹ️  Expected error (no credentials in DB):', error.message);
    }

    console.log('\n✅ SIP Integration test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the database migration: add-sip-config-to-twilio-credentials.sql');
    console.log('2. Set up your Twilio credentials through the frontend');
    console.log('3. Verify the SIP configuration is created and stored correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSipIntegration();

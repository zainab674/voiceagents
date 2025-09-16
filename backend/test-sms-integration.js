// test-sms-integration.js
// Test script to verify SMS integration functionality

import { SMSDatabaseService } from './services/sms-database-service.js';
import { SMSAIService } from './services/sms-ai-service.js';
import { SMSAssistantService } from './services/sms-assistant-service.js';
import { createClient } from '@supabase/supabase-js';

async function testSMSIntegration() {
  console.log('🧪 Testing SMS Integration...\n');

  // Initialize services
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const smsDatabaseService = new SMSDatabaseService(supabase);
  const smsAIService = new SMSAIService();

  try {
    console.log('1. Testing SMS AI Service...');
    
    // Test first message generation
    const firstMessage = smsAIService.generateFirstSMSMessage('Welcome! How can I help?', {});
    console.log('✅ First message generated:', firstMessage);

    // Test conversation end detection
    const isEnd = smsAIService.isConversationEnd('bye bye');
    console.log('✅ Conversation end detection:', isEnd);

    // Test message validation
    const validation = smsAIService.validateMessage('Hello, this is a test message');
    console.log('✅ Message validation:', validation);

    // Test intent extraction
    const intent = smsAIService.extractIntent('I need to schedule an appointment');
    console.log('✅ Intent extraction:', intent);

    console.log('\n2. Testing SMS Database Service...');
    
    // Test conversation history (will return empty array if no data)
    const history = await smsDatabaseService.getConversationHistory('+1234567890', 'test-assistant-id', 5);
    console.log('✅ Conversation history retrieved:', history.length, 'messages');

    // Test new conversation check
    const isNew = await smsDatabaseService.isNewConversation('+1234567890', 'test-assistant-id');
    console.log('✅ New conversation check:', isNew);

    console.log('\n3. Testing SMS Assistant Service...');
    
    // Test SMS response generation
    const response = await smsAIService.generateSMSResponse(
      'Hello, I need help',
      'You are a helpful assistant',
      [],
      { name: 'Test Assistant' }
    );
    console.log('✅ SMS response generated:', response);

    console.log('\n4. Testing message formatting...');
    
    const formatted = smsAIService.formatMessage('  Hello   world  \n\n  ');
    console.log('✅ Message formatted:', `"${formatted}"`);

    console.log('\n✅ SMS Integration test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the database migration: create-sms-messages-table.sql');
    console.log('2. Set up your Twilio credentials');
    console.log('3. Assign a phone number to an assistant');
    console.log('4. Test SMS sending and receiving');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSMSIntegration();

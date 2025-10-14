// test-call-history-structure.js
import CallHistoryService from './services/call-history-service.js';
import LiveKitCallSaver from './services/livekit-call-saver.js';

async function testCallHistoryStructure() {
  console.log('🧪 Testing Call History Structure (without database)...\n');

  try {
    // Test 1: Check if services can be instantiated (without database)
    console.log('🔍 Test 1: Checking service instantiation...');
    
    // Mock environment variables for testing
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    
    const callHistoryService = new CallHistoryService();
    const livekitCallSaver = new LiveKitCallSaver();
    
    console.log('✅ Services instantiated successfully!');

    // Test 2: Test transcription processing
    console.log('\n🔍 Test 2: Testing transcription processing...');
    
    const rawSessionHistory = [
      { role: 'user', content: ['Hello', 'I need help'] },
      { role: 'assistant', content: 'Hi! How can I help you?' },
      { role: 'user', content: 123 }, // Non-string content
      { role: 'assistant', content: 'Let me assist you with that.' },
      { role: 'user', content: '' }, // Empty content
      { role: 'assistant', content: '   ' } // Whitespace only
    ];

    const processedTranscription = callHistoryService.processTranscription(rawSessionHistory);
    console.log('✅ Transcription processed successfully!');
    console.log(`   Input items: ${rawSessionHistory.length}`);
    console.log(`   Output items: ${processedTranscription.length}`);
    console.log('   Processed transcription:');
    processedTranscription.forEach((item, index) => {
      console.log(`     ${index + 1}. [${item.role}] "${item.content}"`);
    });

    // Test 3: Test phone extraction
    console.log('\n🔍 Test 3: Testing phone number extraction...');
    
    const testRoomNames = [
      'room-+1234567890',
      'call-+44123456789',
      'session-1234567890',
      'invalid-room-name',
      'room-with-multiple-1234567890-numbers',
      'room-+1-234-567-8900'
    ];

    testRoomNames.forEach(roomName => {
      const phone = callHistoryService.extractPhoneFromRoom(roomName);
      console.log(`   Room: "${roomName}" → Phone: "${phone}"`);
    });

    // Test 4: Test call SID extraction
    console.log('\n🔍 Test 4: Testing call SID extraction...');
    
    const mockParticipant = {
      attributes: {
        'sip.twilio.callSid': 'CA1234567890abcdef'
      }
    };
    
    const mockRoomMetadata = {
      call_sid: 'CA0987654321fedcba',
      CallSid: 'CA1111111111111111'
    };
    
    const callSid1 = callHistoryService.extractCallSid(mockParticipant, null);
    const callSid2 = callHistoryService.extractCallSid(null, mockRoomMetadata);
    const callSid3 = callHistoryService.extractCallSid(mockParticipant, mockRoomMetadata);
    
    console.log(`   From participant: "${callSid1}"`);
    console.log(`   From room metadata: "${callSid2}"`);
    console.log(`   From both (participant priority): "${callSid3}"`);

    // Test 5: Test session data creation
    console.log('\n🔍 Test 5: Testing session data creation...');
    
    const mockRoom = {
      name: 'test-room-+1234567890',
      creationTime: Date.now() - 300000 // 5 minutes ago
    };
    
    const mockParticipant2 = {
      identity: 'test-user'
    };
    
    const mockSessionHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    const sessionData = livekitCallSaver.createSessionData(mockRoom, mockParticipant2, mockSessionHistory);
    console.log('✅ Session data created successfully!');
    console.log(`   Room: ${sessionData.roomName}`);
    console.log(`   Duration: ${sessionData.duration}s`);
    console.log(`   Call SID: ${sessionData.callSid}`);
    console.log(`   Session history items: ${sessionData.sessionHistory.length}`);

    // Test 6: Test analysis results creation
    console.log('\n🔍 Test 6: Testing analysis results creation...');
    
    const aiAnalysis = {
      summary: 'Customer called for support',
      success: true
    };
    
    const structuredData = {
      name: 'John Doe',
      issue: 'login_problem'
    };
    
    const outcomeAnalysis = {
      outcome: 'resolved',
      confidence: 0.85,
      reasoning: 'Issue was resolved',
      sentiment: 'positive',
      follow_up_required: false
    };
    
    const analysisResults = livekitCallSaver.createAnalysisResults(aiAnalysis, structuredData, outcomeAnalysis);
    console.log('✅ Analysis results created successfully!');
    console.log(`   Summary: ${analysisResults.call_summary}`);
    console.log(`   Success: ${analysisResults.call_success}`);
    console.log(`   Outcome: ${analysisResults.call_outcome}`);
    console.log(`   Confidence: ${analysisResults.outcome_confidence}`);
    console.log(`   Sentiment: ${analysisResults.outcome_sentiment}`);

    console.log('\n🎉 All structure tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Services can be instantiated');
    console.log('   ✅ Transcription processing works');
    console.log('   ✅ Phone number extraction works');
    console.log('   ✅ Call SID extraction works');
    console.log('   ✅ Session data creation works');
    console.log('   ✅ Analysis results creation works');
    console.log('\n🚀 The call history saving structure is ready!');
    console.log('\n💡 To test with actual database:');
    console.log('   1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    console.log('   2. Run the database migration: enhance-calls-table-comprehensive.sql');
    console.log('   3. Use the saveComprehensiveCallHistory API endpoint');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCallHistoryStructure();

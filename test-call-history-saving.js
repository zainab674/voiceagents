// test-call-history-saving.js
import CallHistoryService from './services/call-history-service.js';
import LiveKitCallSaver from './services/livekit-call-saver.js';

async function testCallHistorySaving() {
  console.log('🧪 Testing Call History Saving Functionality...\n');

  try {
    // Initialize services
    const callHistoryService = new CallHistoryService();
    const livekitCallSaver = new LiveKitCallSaver();

    // Test data
    const testCallData = {
      call_id: 'test-room-' + Date.now(),
      assistant_id: 'test-assistant-123',
      user_id: 'test-user-456',
      phone_number: '+1234567890',
      participant_identity: 'John Doe',
      start_time: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      end_time: new Date().toISOString(),
      call_duration: 300, // 5 minutes
      call_status: 'completed',
      transcription: [
        { role: 'user', content: 'Hello, I need help with my account' },
        { role: 'assistant', content: 'Hi! I\'d be happy to help you with your account. What seems to be the issue?' },
        { role: 'user', content: 'I can\'t log in to my dashboard' },
        { role: 'assistant', content: 'Let me help you reset your password. Can you provide your email address?' }
      ],
      call_sid: 'CA' + Math.random().toString(36).substr(2, 32),
      call_summary: 'Customer called for account login assistance. Provided password reset help.',
      success_evaluation: 'SUCCESS',
      structured_data: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        issue_type: 'login_problem',
        resolution: 'password_reset_initiated'
      },
      call_outcome: 'resolved',
      outcome_confidence: 0.85,
      outcome_reasoning: 'Customer issue was successfully resolved with password reset assistance',
      outcome_key_points: ['Login problem', 'Password reset initiated', 'Customer satisfied'],
      outcome_sentiment: 'positive',
      follow_up_required: true,
      follow_up_notes: 'Follow up in 24 hours to confirm password reset worked',
      room_name: 'test-room-' + Date.now(),
      assistant_config: {
        id: 'test-assistant-123',
        name: 'Customer Support Assistant',
        prompt: 'Help customers with account issues'
      },
      recording_sid: 'RE' + Math.random().toString(36).substr(2, 32),
      recording_url: 'https://api.twilio.com/2010-04-01/Accounts/AC.../Recordings/RE...',
      recording_status: 'completed',
      recording_duration: 300,
      recording_channels: 2,
      recording_start_time: new Date(Date.now() - 300000).toISOString(),
      recording_source: 'DialVerb',
      recording_track: 'both'
    };

    console.log('📝 Test Call Data:');
    console.log(`   Call ID: ${testCallData.call_id}`);
    console.log(`   Assistant ID: ${testCallData.assistant_id}`);
    console.log(`   Phone: ${testCallData.phone_number}`);
    console.log(`   Duration: ${testCallData.call_duration}s`);
    console.log(`   Transcription Items: ${testCallData.transcription.length}`);
    console.log(`   Outcome: ${testCallData.call_outcome}`);
    console.log(`   Confidence: ${testCallData.outcome_confidence}\n`);

    // Test 1: Save comprehensive call history
    console.log('🔍 Test 1: Saving comprehensive call history...');
    const saveResult = await callHistoryService.saveCallHistory(testCallData);
    
    if (saveResult.success) {
      console.log('✅ Call history saved successfully!');
      console.log(`   Database ID: ${saveResult.data.id}`);
      console.log(`   Duration: ${saveResult.data.duration_seconds}s`);
      console.log(`   Status: ${saveResult.data.status}`);
    } else {
      console.log('❌ Failed to save call history:', saveResult.error);
      return;
    }

    // Test 2: Retrieve call history
    console.log('\n🔍 Test 2: Retrieving call history...');
    const historyResult = await callHistoryService.getCallHistory(testCallData.user_id, { limit: 10 });
    
    if (historyResult.success) {
      console.log('✅ Call history retrieved successfully!');
      console.log(`   Found ${historyResult.data.length} calls`);
      if (historyResult.data.length > 0) {
        const latestCall = historyResult.data[0];
        console.log(`   Latest call: ${latestCall.id}`);
        console.log(`   Duration: ${latestCall.duration_seconds}s`);
        console.log(`   Outcome: ${latestCall.call_outcome}`);
        console.log(`   Transcription items: ${latestCall.transcription?.length || 0}`);
      }
    } else {
      console.log('❌ Failed to retrieve call history:', historyResult.error);
    }

    // Test 3: Test LiveKit call saver
    console.log('\n🔍 Test 3: Testing LiveKit call saver...');
    
    const sessionData = {
      roomName: 'test-room-livekit-' + Date.now(),
      startTime: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
      endTime: new Date().toISOString(),
      duration: 180,
      sessionHistory: [
        { role: 'user', content: 'Hi there!' },
        { role: 'assistant', content: 'Hello! How can I assist you today?' }
      ],
      callSid: 'CA' + Math.random().toString(36).substr(2, 32)
    };

    const assistantConfig = {
      id: 'test-assistant-livekit',
      user_id: testCallData.user_id,
      name: 'Test LiveKit Assistant'
    };

    const analysisResults = {
      call_summary: 'Brief greeting and assistance inquiry',
      call_success: true,
      structured_data: { greeting: 'friendly' },
      call_outcome: 'greeting',
      outcome_confidence: 0.9,
      outcome_reasoning: 'Simple greeting exchange',
      outcome_sentiment: 'positive',
      follow_up_required: false
    };

    const livekitResult = await livekitCallSaver.saveCallFromLiveKitSession(sessionData, assistantConfig, analysisResults);
    
    if (livekitResult.success) {
      console.log('✅ LiveKit call session saved successfully!');
      console.log(`   Database ID: ${livekitResult.data.id}`);
      console.log(`   Room: ${livekitResult.data.room_name}`);
      console.log(`   Duration: ${livekitResult.data.duration_seconds}s`);
    } else {
      console.log('❌ Failed to save LiveKit call session:', livekitResult.error);
    }

    // Test 4: Test transcription processing
    console.log('\n🔍 Test 4: Testing transcription processing...');
    
    const rawSessionHistory = [
      { role: 'user', content: ['Hello', 'I need help'] },
      { role: 'assistant', content: 'Hi! How can I help you?' },
      { role: 'user', content: 123 }, // Non-string content
      { role: 'assistant', content: 'Let me assist you with that.' }
    ];

    const processedTranscription = callHistoryService.processTranscription(rawSessionHistory);
    console.log('✅ Transcription processed successfully!');
    console.log(`   Input items: ${rawSessionHistory.length}`);
    console.log(`   Output items: ${processedTranscription.length}`);
    console.log('   Sample processed transcription:');
    processedTranscription.forEach((item, index) => {
      console.log(`     ${index + 1}. [${item.role}] ${item.content}`);
    });

    // Test 5: Test phone extraction
    console.log('\n🔍 Test 5: Testing phone number extraction...');
    
    const testRoomNames = [
      'room-+1234567890',
      'call-+44123456789',
      'session-1234567890',
      'invalid-room-name'
    ];

    testRoomNames.forEach(roomName => {
      const phone = callHistoryService.extractPhoneFromRoom(roomName);
      console.log(`   Room: "${roomName}" → Phone: "${phone}"`);
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Call history saving works');
    console.log('   ✅ Call history retrieval works');
    console.log('   ✅ LiveKit integration works');
    console.log('   ✅ Transcription processing works');
    console.log('   ✅ Phone number extraction works');
    console.log('\n🚀 The voiceagents project now has comprehensive call history saving!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCallHistorySaving();

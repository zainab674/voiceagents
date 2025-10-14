#!/usr/bin/env node
/**
 * Test script for the NEW TwiML Room approach (like sass-livekit)
 * This tests the corrected call flow: Twilio → LiveKit Room → AI Agent
 */

import fetch from 'node-fetch';
import 'dotenv/config';

const BACKEND_URL = process.env.NGROK_URL || process.env.BACKEND_URL || 'http://localhost:4000';
const TWILIO_VOICE_WEBHOOK_URL = `${BACKEND_URL}/api/v1/twilio/voice`;

async function testNewCallFlow() {
  console.log('🧪 Testing NEW TwiML Room Call Flow');
  console.log('====================================');
  console.log('This tests the corrected approach: Twilio → LiveKit Room → AI Agent');
  console.log('');

  try {
    console.log(`📞 Testing webhook at: ${TWILIO_VOICE_WEBHOOK_URL}`);
    console.log('');

    const response = await fetch(TWILIO_VOICE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: '+15551234567', // Replace with a number assigned to an assistant
        From: '+15559876543', // A dummy caller number
        CallSid: 'test-call-sid-12345',
        Direction: 'inbound',
      }).toString(),
    });

    const responseText = await response.text();
    console.log('📊 Response Status:', response.status);
    console.log('📄 Response Body:');
    console.log(responseText);
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook test successful!');
      
      // Check for the new TwiML Room approach
      if (responseText.includes('<Connect>') && responseText.includes('<Room')) {
        console.log('✅ Response contains TwiML Room connection - CORRECT APPROACH!');
        
        // Extract room name from response
        const roomMatch = responseText.match(/roomName="([^"]+)"/);
        if (roomMatch) {
          console.log(`✅ LiveKit room created: ${roomMatch[1]}`);
        }
        
        // Extract assistant ID from response
        const assistantMatch = responseText.match(/name="assistantId" value="([^"]+)"/);
        if (assistantMatch) {
          console.log(`✅ Assistant ID found: ${assistantMatch[1]}`);
        }
        
        // Extract phone number from response
        const phoneMatch = responseText.match(/name="phoneNumber" value="([^"]+)"/);
        if (phoneMatch) {
          console.log(`✅ Phone number: ${phoneMatch[1]}`);
        }
        
        console.log('');
        console.log('🎉 SUCCESS! The new call flow is working correctly:');
        console.log('   1. Twilio receives incoming call');
        console.log('   2. Webhook finds assistant for phone number');
        console.log('   3. LiveKit room is created with metadata');
        console.log('   4. TwiML connects Twilio to LiveKit room');
        console.log('   5. AI agent will join the room');
        
      } else if (responseText.includes('<Dial>') && responseText.includes('sip:')) {
        console.log('⚠️  Response contains old SIP approach - this might not work');
        console.log('   The old approach tries to connect directly to SIP, which can cause disconnections');
        
      } else {
        console.log('❓ Unexpected response format');
      }
      
    } else {
      console.error('❌ Webhook test failed. Status:', response.status);
      console.log('Check your backend logs for errors');
    }
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }
  
  console.log('');
  console.log('🔧 Next Steps:');
  console.log('   1. Make sure you have a phone number assigned to an assistant');
  console.log('   2. Update the "To" phone number in this script to match your assigned number');
  console.log('   3. Call the assigned phone number to test the real flow');
  console.log('   4. Check LiveKit logs for room creation and agent joining');
  console.log('   5. Check backend logs for webhook processing');
}

// Run the test
testNewCallFlow().catch(console.error);

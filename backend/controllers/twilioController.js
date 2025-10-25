import twilio from "twilio";
import express from "express";
import { 
  getPhoneNumbers, 
  getUserPhoneNumbers,
  assignNumber, 
  getTrunks, 
  attachToTrunk, 
  mapNumber, 
  createTrunk, 
  deleteTrunk 
} from "#services/twilioAdminService.js";
import { 
  enableTrunkRecording, 
  getCallRecordingInfo 
} from "#services/twilioMainTrunkService.js";
import { 
  listInboundTrunks, 
  listDispatchRules, 
  autoAssignNumber, 
  resolveAssistant, 
  cleanupDispatchRules,
  createAssistantTrunk
} from "#services/livekitSipService.js";
import { TwilioCredentialsService } from "#services/twilioCredentialsService.js";
import { generateRandomAlphanumeric } from "#utils/generateRandomToken.js";

// Web call Access Token using user-specific credentials
export const generateWebCallAccessToken = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { agentId } = req.query; // Get agentId from query parameters
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Get user's Twilio credentials
    const credentials = await TwilioCredentialsService.getActiveCredentials(userId);
    if (!credentials) {
      return res.status(400).json({
        success: false,
        message: "No active Twilio credentials found for user"
      });
    }

    // For web calls, we still need API keys and TwiML app SID
    // These should be stored per user or configured per user
    const apiKey = process.env.TWILIO_WEB_CALL_API_KEY; // API Key SID
    const apiKeySecret = process.env.TWILIO_WEB_CALL_API_SECRET; // API Key Secret
    const twimlAppSid = process.env.TWILIO_WEB_CALL_SID; // TwiML App SID

    if (!apiKey || !apiKeySecret || !twimlAppSid) {
      return res.status(400).json({
        success: false,
        message: "Missing Twilio web call configuration: TWILIO_WEB_CALL_API_KEY, TWILIO_WEB_CALL_API_SECRET, TWILIO_WEB_CALL_SID"
      });
    }

    // Create a unique room name for this webcall
    const roomName = `webcall-${generateRandomAlphanumeric(8)}-${Date.now()}`;
    const identity = req.query.identity || `identity-${Math.random().toString(36).slice(2, 8)}`;

    // Generate Twilio access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const accessToken = new AccessToken(credentials.account_sid, apiKey, apiKeySecret, {
      identity,
      ttl: 3600,
    });
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    accessToken.addGrant(voiceGrant);

    // Dispatch LiveKit agent to the room (if agentId is provided)
    let agentDispatchResult = null;
    if (agentId) {
      try {
        console.log(`🤖 Dispatching agent for webcall: room=${roomName}, agentId=${agentId}`);
        
        // Import LiveKit dependencies dynamically
        const { AgentDispatchClient, AccessToken: LKAccessToken } = await import('livekit-server-sdk');
        
        // Create LiveKit agent dispatch client
        const livekitHttpUrl = process.env.LIVEKIT_HOST?.replace('wss://', 'https://').replace('ws://', 'http://') || 'https://your-livekit-host.com';
        const agentDispatchClient = new AgentDispatchClient(
          livekitHttpUrl, 
          process.env.LIVEKIT_API_KEY, 
          process.env.LIVEKIT_API_SECRET
        );

        // Create access token for agent dispatch
        const at = new LKAccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
          identity: `webcall-dispatcher-${Date.now()}`,
          metadata: JSON.stringify({
            userId,
            agentId,
            callType: 'webcall',
            roomName
          })
        });

        at.addGrant({
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
        });

        const jwt = await at.toJwt();

        // Dispatch agent using AgentDispatchClient
        const agentName = process.env.LK_AGENT_NAME || 'ai';
        agentDispatchResult = await agentDispatchClient.createDispatch(roomName, agentName, {
          metadata: JSON.stringify({
            agentId: agentId,
            callType: 'webcall',
            userId: userId,
            roomName: roomName,
            webcall: true
          }),
        });

        console.log('✅ Webcall agent dispatched successfully:', agentDispatchResult);
      } catch (dispatchError) {
        console.error('❌ Failed to dispatch agent for webcall:', dispatchError);
        // Don't fail the entire request if agent dispatch fails
        // The webcall can still work without the agent
      }
    }

    return res.json({ 
      success: true, 
      token: accessToken.toJwt(), 
      identity,
      roomName: roomName,
      agentDispatched: !!agentDispatchResult,
      agentDispatchResult: agentDispatchResult
    });
  } catch (error) {
    console.error("Error generating web call access token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate access token"
    });
  }
};

// Inbound Voice Webhook (TwiML) - Connects to LiveKit SIP
export const twilioVoiceWebhook = async (req, res) => {
  try {
    const { twiml } = twilio;
    const response = new twiml.VoiceResponse();
    
    // Get phone number from Twilio request
    const toNumber = req.body.To || req.query.To;
    const fromNumber = req.body.From || req.query.From;
    
    console.log(`📞 Incoming call: From ${fromNumber} to ${toNumber}`);
    
    if (!toNumber) {
      console.error('❌ No phone number found in webhook request');
      response.say({ voice: "alice" }, "I'm sorry, there was an error processing your call. Please try again later.");
      response.hangup();
      res.set("Content-Type", "application/xml");
      return res.send(response.toString());
    }
    
    // Get LiveKit SIP configuration from environment
    const livekitSipDomain = process.env.LIVEKIT_SIP_DOMAIN || process.env.LIVEKIT_HOST?.replace('wss://', '').replace('ws://', '');
    
    if (!livekitSipDomain) {
      console.error('❌ LiveKit SIP domain not configured');
      response.say({ voice: "alice" }, "I'm sorry, there was a configuration error. Please try again later.");
      response.hangup();
      res.set("Content-Type", "application/xml");
      return res.send(response.toString());
    }
    
    console.log(`🔗 Connecting call to LiveKit SIP for number: ${toNumber}`);
    console.log(`🌐 Using LiveKit SIP domain: ${livekitSipDomain}`);
    
    // Use TwiML to connect to LiveKit SIP
    // The phone number should already be configured with LiveKit SIP dispatch rules
    const dial = response.dial({
      timeout: 30,
      hangupOnStar: false,
      record: 'record-from-ringing-dual',
      recordingStatusCallback: `${process.env.NGROK_URL || process.env.BACKEND_URL || 'http://localhost:4000'}/api/v1/recording/webhook`
    });
    
    // Connect to LiveKit SIP trunk using the phone number
    // LiveKit will route this to the appropriate room based on dispatch rules
    const sipUri = `sip:${toNumber}@${livekitSipDomain}`;
    dial.sip(sipUri);
    
    console.log(`✅ Call connected to LiveKit SIP: ${sipUri}`);
    
    res.set("Content-Type", "application/xml");
    return res.send(response.toString());
    
  } catch (error) {
    console.error('❌ Error in Twilio voice webhook:', error);
    
    const { twiml } = twilio;
    const response = new twiml.VoiceResponse();
    response.say({ voice: "alice" }, "I'm sorry, there was a technical error. Please try calling again later.");
    response.hangup();
    
    res.set("Content-Type", "application/xml");
    return res.send(response.toString());
  }
};

// Respond to Gather (TwiML) – echoes back speech for now
export const twilioVoiceRespond = (req, res) => {
  const userSpeech = (req.body?.SpeechResult || "").toString();
  const { twiml } = twilio;
  const response = new twiml.VoiceResponse();

  if (!userSpeech) {
    response.say({ voice: "alice" }, "I did not catch that. Goodbye.");
    response.hangup();
  } else {
    response.say({ voice: "alice" }, `You said: ${userSpeech}. Goodbye.`);
    response.hangup();
  }

  res.set("Content-Type", "application/xml");
  return res.send(response.toString());
};

// Optional: initiate an outbound call using user-specific credentials
export const makeOutboundCall = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User authentication required" 
      });
    }

    // Get user's Twilio credentials
    const credentials = await TwilioCredentialsService.getActiveCredentials(userId);
    if (!credentials) {
      return res.status(400).json({ 
        success: false, 
        message: "No active Twilio credentials found for user" 
      });
    }

    const client = twilio(credentials.account_sid, credentials.auth_token);

    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ success: false, message: "from and to are required" });
    }

    const callbackUrl = `${req.protocol}://${req.get("host")}/api/v1/twilio/voice`;
    await client.calls.create({ from, to, url: callbackUrl });
    return res.json({ success: true, message: "Call initiated" });
  } catch (err) {
    console.error("Twilio outbound call error", err.message);
    return res.status(500).json({ success: false, message: "Failed to create call" });
  }
};

// ------------------- Enhanced Twilio Admin Functions -------------------

// Get phone numbers
export const getPhoneNumbersController = async (req, res) => {
  const result = await getPhoneNumbers(req);
  const status = result.success ? 200 : 500;
  res.status(status).json(result);
};

// Get phone numbers using user's saved credentials
export const getUserPhoneNumbersController = async (req, res) => {
  const result = await getUserPhoneNumbers(req);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
};

// Assign number to webhook
export const assignNumberController = async (req, res) => {
  const result = await assignNumber(req);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
};

// Get trunks
export const getTrunksController = async (req, res) => {
  const result = await getTrunks();
  const status = result.success ? 200 : 500;
  res.status(status).json(result);
};

// Attach number to trunk
export const attachToTrunkController = async (req, res) => {
  const result = await attachToTrunk(req);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
};

// Map number to assistant
export const mapNumberController = async (req, res) => {
  const result = await mapNumber(req);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
};

// Create trunk
export const createTrunkController = async (req, res) => {
  const result = await createTrunk(req);
  const status = result.success ? 201 : 400;
  res.status(status).json(result);
};

// Delete trunk
export const deleteTrunkController = async (req, res) => {
  const result = await deleteTrunk(req);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
};

// ------------------- LiveKit SIP Functions -------------------

// List inbound trunks
export const listInboundTrunksController = async (req, res) => {
  const result = await listInboundTrunks();
  const status = result.success ? 200 : 500;
  res.status(status).json(result);
};

// List dispatch rules
export const listDispatchRulesController = async (req, res) => {
  const result = await listDispatchRules();
  const status = result.success ? 200 : 500;
  res.status(status).json(result);
};

// Auto assign number to agent
export const autoAssignNumberController = async (req, res) => {
  const result = await autoAssignNumber(req.body);
  const status = result.success ? 200 : 400;
  res.status(status).json(result);
};

// Resolve assistant by ID
export const resolveAssistantController = async (req, res) => {
  const { id } = req.params;
  const result = await resolveAssistant(id);
  const status = result.success ? 200 : 404;
  res.status(status).json(result);
};

// Cleanup dispatch rules
export const cleanupDispatchRulesController = async (req, res) => {
  const result = await cleanupDispatchRules();
  const status = result.success ? 200 : 500;
  res.status(status).json(result);
};

// Create assistant trunk
export const createAssistantTrunkController = async (req, res) => {
  try {
    const { assistantId, assistantName, phoneNumber } = req.body;
    const userId = req.user?.userId; // Get userId from authenticated user

    if (!assistantId || !assistantName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'assistantId, assistantName, and phoneNumber are required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication required'
      });
    }

    console.log(`🚀 Creating assistant trunk for user: ${userId}, assistant: ${assistantId}, phone: ${phoneNumber}`);

    const result = await createAssistantTrunk({ 
      assistantId, 
      assistantName, 
      phoneNumber, 
      userId 
    });

    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Error creating assistant trunk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assistant trunk',
      error: error.message
    });
  }
};

// ------------------- Recording Functions -------------------

// Enable trunk recording
export const enableTrunkRecordingController = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { trunkSid } = req.body;
    
    if (!trunkSid) {
      return res.status(400).json({ 
        success: false, 
        message: 'trunkSid is required' 
      });
    }

    // Get user's credentials
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: credentials, error: credError } = await supa
      .from('user_twilio_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (credError || !credentials) {
      return res.status(400).json({ 
        success: false, 
        message: 'No Twilio credentials found' 
      });
    }

    const result = await enableTrunkRecording({
      accountSid: credentials.account_sid,
      authToken: credentials.auth_token,
      trunkSid
    });

    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Enable trunk recording error:', error);
    res.status(500).json({ 
      success: false, 
      message: error?.message || 'Failed to enable trunk recording' 
    });
  }
};

// Get call recording info
export const getCallRecordingInfoController = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { callSid } = req.params;
    
    if (!callSid) {
      return res.status(400).json({ 
        success: false, 
        message: 'callSid is required' 
      });
    }

    // Get user's credentials
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: credentials, error: credError } = await supa
      .from('user_twilio_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (credError || !credentials) {
      return res.status(400).json({ 
        success: false, 
        message: 'No Twilio credentials found' 
      });
    }

    const result = await getCallRecordingInfo({
      accountSid: credentials.account_sid,
      authToken: credentials.auth_token,
      callSid
    });

    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Get call recording info error:', error);
    res.status(500).json({ 
      success: false, 
      message: error?.message || 'Failed to get call recording info' 
    });
  }
};



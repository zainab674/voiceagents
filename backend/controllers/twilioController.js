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

// Web call Access Token using user-specific credentials
export const generateWebCallAccessToken = async (req, res) => {
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

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = req.query.identity || `identity-${Math.random().toString(36).slice(2, 8)}`;

    const accessToken = new AccessToken(credentials.account_sid, apiKey, apiKeySecret, {
      identity,
      ttl: 3600,
    });
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    accessToken.addGrant(voiceGrant);

    return res.json({ success: true, token: accessToken.toJwt(), identity });
  } catch (error) {
    console.error("Error generating web call access token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate access token"
    });
  }
};

// Inbound Voice Webhook (TwiML)
export const twilioVoiceWebhook = (req, res) => {
  const { twiml } = twilio;
  const response = new twiml.VoiceResponse();

  // Minimal prompt; replace with your agent logic later
  const sayText = "Thanks for calling. Please say something after the beep.";
  response.say({ voice: "alice" }, sayText);
  response.gather({ input: ["speech"], speechTimeout: "auto", action: "/api/v1/twilio/respond" });

  res.set("Content-Type", "application/xml");
  return res.send(response.toString());
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



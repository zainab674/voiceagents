import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "#routes/index.js";
import { getCallRecordingInfo as getTwilioRecordingInfo } from '#services/twilioMainTrunkService.js';
import { ngrokService } from './services/ngrok-service.js';
import { campaignEngine } from './services/campaign-execution-engine.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:8080",
        "http://localhost:5173", // Vite default port
        "http://localhost:3000"  // Alternative frontend port
    ],
    credentials: true
}));

// Test endpoint to verify server is running
app.get("/", (req, res) => {
    res.json({ message: "Voice Assistant Backend Server is running!" });
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || "development"
    });
});

// API routes
app.use("/api/v1", router);

// Recording routes (matching sass-livekit pattern)

// Get recording information for a call
app.get('/api/v1/call/:callSid/recordings', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { accountSid, authToken } = req.query;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: 'accountSid and authToken are required'
      });
    }

    const result = await getTwilioRecordingInfo({ accountSid, authToken, callSid });
    res.json(result);
  } catch (error) {
    console.error('Error getting call recording info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Proxy endpoint to serve recording audio files with authentication
app.get('/api/v1/call/recording/:recordingSid/audio', async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const { accountSid, authToken } = req.query;

    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: 'accountSid and authToken are required'
      });
    }

    // Construct the Twilio recording URL
    const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.wav`;
    
    // Make authenticated request to Twilio
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch recording from Twilio:', response.status, response.statusText);
      return res.status(response.status).json({
        success: false,
        message: `Failed to fetch recording: ${response.statusText}`
      });
    }

    // Get the audio data as a buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Send the audio data
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('Error proxying recording audio:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 404 handler for unmatched routes
app.use("*", (req, res) => {
    res.status(404).json({
        error: "Route not found",
        path: req.originalUrl,
        availableRoutes: [
            "GET /",
            "GET /health",
            "POST /api/v1/auth/register",
            "POST /api/v1/auth/login",
            "GET /api/v1/auth/me",
            "POST /api/v1/auth/logout",
            "GET /api/v1/users/test",
            "GET /api/v1/users",
            "GET /api/v1/users/stats",
            "GET /api/v1/users/:id",
            "POST /api/v1/users",
            "PUT /api/v1/users/:id",
            "DELETE /api/v1/users/:id",
            "GET /api/v1/agents/test",
            "GET /api/v1/agents",
            "POST /api/v1/agents",
            "GET /api/v1/agents/:agentId",
            "PUT /api/v1/agents/:agentId",
            "DELETE /api/v1/agents/:agentId",
            "GET /api/v1/analytics/agents",
            "GET /api/v1/analytics/calls",
            "POST /api/v1/calls/start",
            "POST /api/v1/calls/end",
            "GET /api/v1/calls/history",
            "GET /api/v1/knowledge-base",
            "POST /api/v1/knowledge-base/knowledge-bases",
            "GET /api/v1/knowledge-base/knowledge-bases/:kbId",
            "GET /api/v1/knowledge-base/knowledge-bases/company/:companyId",
            "PUT /api/v1/knowledge-base/knowledge-bases/:kbId",
            "DELETE /api/v1/knowledge-base/knowledge-bases/:kbId",
            "POST /api/v1/knowledge-base/upload",
            "GET /api/v1/knowledge-base/documents/:companyId",
            "GET /api/v1/knowledge-base/documents/:docId/details",
            "POST /api/v1/knowledge-base/knowledge-bases/:kbId/documents/:docId",
            "POST /api/v1/knowledge-base/knowledge-bases/:kbId/context",
            "POST /api/v1/knowledge-base/knowledge-bases/:kbId/context/enhanced",
            "POST /api/v1/knowledge-base/knowledge-bases/:kbId/context/multi-search",
            "POST /api/v1/knowledge-base/knowledge-bases/:kbId/context/filtered"
        ]
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: "Internal server error",
        message: err.message
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api/v1`);
    console.log(`🔍 Health check at http://localhost:${PORT}/health`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:8080"}`);
    
    // Check if ngrok should be started
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_NGROK === 'true') {
        try {
            console.log('\n🌐 Starting ngrok tunnel for development...');
            await ngrokService.start();
            
            const webhookUrls = ngrokService.getWebhookUrls();
            if (webhookUrls) {
                console.log('\n📋 Webhook URLs for development:');
                console.log(`   SMS Webhook: ${webhookUrls.smsWebhook}`);
                console.log(`   Voice Webhook: ${webhookUrls.voiceWebhook}`);
                console.log(`   Status Callback: ${webhookUrls.statusCallback}`);
            }
        } catch (error) {
            console.error('❌ Failed to start ngrok:', error.message);
            console.log('💡 You can still use the server locally without ngrok');
        }
    } else if (process.env.NGROK_URL) {
        console.log(`🌐 Using existing ngrok URL: ${process.env.NGROK_URL}`);
    }
    
    // Start campaign execution engine
    console.log('\n🚀 Starting campaign execution engine...');
    campaignEngine.start();
    console.log('✅ Campaign execution engine started');

    // Start ngrok tunnel for Twilio webhooks
    if (process.env.NGROK_AUTHTOKEN) {
      try {
        const { connect } = await import('@ngrok/ngrok');
        const listener = await connect({
          addr: PORT,
          authtoken_from_env: true
        });

        console.log(`🌐 ngrok tunnel established at: ${listener.url()}`);
        console.log(`📱 Use this URL for Twilio SMS webhooks: ${listener.url()}/api/v1/sms/webhook`);
        console.log(`📞 Use this URL for Twilio status callbacks: ${listener.url()}/api/v1/sms/status-callback`);

        // Store the ngrok URL for use in SMS sending
        process.env.NGROK_URL = listener.url();

        // SMS webhooks are configured automatically when phone numbers are assigned to assistants
        console.log('✅ SMS webhook URLs are ready for phone number assignment');

      } catch (error) {
        console.error('❌ Failed to start ngrok tunnel:', error.message);
        console.log('💡 Make sure NGROK_AUTHTOKEN is set in your .env file');
      }
    } else {
      console.log('⚠️  NGROK_AUTHTOKEN not set - webhooks will not work with localhost');
      console.log('💡 Add NGROK_AUTHTOKEN to your .env file to enable ngrok tunnel');
      console.log('   SMS webhooks are configured automatically when phone numbers are assigned to assistants');
    }
});






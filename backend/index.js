import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import router from "#routes/index.js";
import { getCallRecordingInfo as getTwilioRecordingInfo } from '#services/twilioMainTrunkService.js';
import { ngrokService } from './services/ngrok-service.js';
import { campaignEngine } from './services/campaign-execution-engine.js';
import { emailCampaignExecutionEngine } from './services/email-campaign-execution-engine.js';
import { tenantMiddleware } from '#middlewares/tenantMiddleware.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// CORS configuration - allow whitelabel subdomains
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:8080",
  "http://localhost:5173", // Vite default port
  "http://localhost:3000"
];

// Add main domain and subdomains if MAIN_DOMAIN is set
if (process.env.MAIN_DOMAIN) {
  const mainDomain = process.env.MAIN_DOMAIN;
  allowedOrigins.push(
    `https://${mainDomain}`,
    `http://${mainDomain}`
  );
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check for localhost subdomains (whitelabel subdomains)
    // Matches: http://anything.localhost:8080, http://anything.localhost:5173, etc.
    const localhostSubdomainRegex = /^https?:\/\/[a-z0-9-]+\.localhost(:\d+)?$/;
    if (localhostSubdomainRegex.test(origin)) {
      return callback(null, true);
    }

    // Explicitly allow aiassistant.net subdomains (production whitelabel)
    const productionSubdomainRegex = /^https?:\/\/[a-z0-9-]+\.aiassistant\.net(:\d+)?$/;
    if (productionSubdomainRegex.test(origin)) {
      return callback(null, true);
    }

    // Check for main domain subdomains (generic, if MAIN_DOMAIN is set)
    if (process.env.MAIN_DOMAIN) {
      const mainDomain = process.env.MAIN_DOMAIN.replace('.', '\\.');
      const subdomainRegex = new RegExp(`^https?://[a-z0-9-]+\\.${mainDomain}(:\\d+)?$`);
      if (subdomainRegex.test(origin)) {
        return callback(null, true);
      }
    }

    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      console.log(`✅ Allowing localhost origin: ${origin}`);
      return callback(null, true);
    }

    console.warn(`⚠️  CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant', 'X-Requested-With']
}));

app.use(tenantMiddleware);

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

// Serve uploaded assets (logos, documents, etc.)
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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
      "GET /api/v1/kb",
      "POST /api/v1/kb/knowledge-bases",
      "GET /api/v1/kb/knowledge-bases/:kbId",
      "GET /api/v1/kb/knowledge-bases/company/:companyId",
      "PUT /api/v1/kb/knowledge-bases/:kbId",
      "DELETE /api/v1/kb/knowledge-bases/:kbId",
      "POST /api/v1/kb/upload",
      "GET /api/v1/kb/documents/:companyId",
      "GET /api/v1/kb/documents/:docId/details",
      "POST /api/v1/kb/knowledge-bases/:kbId/documents/:docId",
      "POST /api/v1/kb/knowledge-bases/:kbId/context",
      "POST /api/v1/kb/knowledge-bases/:kbId/context/enhanced",
      "POST /api/v1/kb/knowledge-bases/:kbId/context/multi-search",
      "POST /api/v1/kb/knowledge-bases/:kbId/context/filtered",
      "GET /api/v1/agent-templates",
      "POST /api/v1/agent-templates",
      "GET /api/v1/agent-templates/:templateId",
      "PUT /api/v1/agent-templates/:templateId",
      "DELETE /api/v1/agent-templates/:templateId",
      "POST /api/v1/agent-templates/:templateId/clone"
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

  // Start campaign execution engines
  console.log('\n🚀 Starting campaign execution engines...');
  campaignEngine.start();
  emailCampaignExecutionEngine.start();
  console.log('✅ Campaign execution engines started');

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






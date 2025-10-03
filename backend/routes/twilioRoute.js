import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import {
  generateWebCallAccessToken,
  twilioVoiceWebhook,
  twilioVoiceRespond,
  makeOutboundCall,
  // Enhanced Twilio Admin Functions
  getPhoneNumbersController,
  getUserPhoneNumbersController,
  assignNumberController,
  getTrunksController,
  attachToTrunkController,
  mapNumberController,
  createTrunkController,
  deleteTrunkController,
  // LiveKit SIP Functions
  listInboundTrunksController,
  listDispatchRulesController,
  autoAssignNumberController,
  resolveAssistantController,
  cleanupDispatchRulesController,
  createAssistantTrunkController,
  // Recording Functions
  enableTrunkRecordingController,
  getCallRecordingInfoController,
} from "#controllers/twilioController.js";
import {
  sendSMS,
  getSMSMessages,
  smsWebhook,
  smsStatusCallback,
  getSMSStats
} from "#controllers/smsController.js";

const router = express.Router();

// ------------------- Basic Twilio Functions -------------------
router.get("/web-token", authenticateToken, generateWebCallAccessToken);
router.post("/voice", express.urlencoded({ extended: false }), twilioVoiceWebhook);
router.post("/respond", express.urlencoded({ extended: false }), twilioVoiceRespond);
router.post("/outbound", authenticateToken, makeOutboundCall);

// ------------------- Enhanced Twilio Admin Functions (require auth) -------------------
router.get("/phone-numbers", authenticateToken, getPhoneNumbersController);
router.get("/user/phone-numbers", authenticateToken, getUserPhoneNumbersController);
router.post("/assign", authenticateToken, assignNumberController);
router.get("/trunks", authenticateToken, getTrunksController);
router.post("/trunk/attach", authenticateToken, attachToTrunkController);
router.post("/map", authenticateToken, mapNumberController);
router.post("/trunk/create", authenticateToken, createTrunkController);
router.delete("/trunk/:trunkSid", authenticateToken, deleteTrunkController);

// ------------------- LiveKit SIP Functions (require auth) -------------------
router.get("/sip/inbound-trunks", authenticateToken, listInboundTrunksController);
router.get("/sip/dispatch-rules", authenticateToken, listDispatchRulesController);
router.post("/sip/auto-assign", authenticateToken, autoAssignNumberController);
router.get("/sip/assistant/:id", authenticateToken, resolveAssistantController);
router.post("/sip/cleanup-rules", authenticateToken, cleanupDispatchRulesController);
router.post("/sip/assistant-trunk", authenticateToken, createAssistantTrunkController);

// ------------------- Recording Functions (require auth) -------------------
router.post("/recording/enable", authenticateToken, enableTrunkRecordingController);
router.get("/recording/:callSid", authenticateToken, getCallRecordingInfoController);

// ------------------- SMS Functions -------------------
router.post("/sms/send", authenticateToken, sendSMS);
router.get("/sms/conversation/:conversationId", authenticateToken, getSMSMessages);
router.get("/sms/stats", authenticateToken, getSMSStats);
// Webhook endpoints (no auth required)
router.post("/sms/webhook", express.urlencoded({ extended: false }), smsWebhook);
router.post("/sms/status-callback", express.urlencoded({ extended: false }), smsStatusCallback);

export default router;



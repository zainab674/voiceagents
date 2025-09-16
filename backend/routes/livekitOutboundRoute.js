// routes/livekitOutboundRoute.js
import express from 'express';
import { livekitOutboundService } from '#services/livekit-outbound-service.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

/**
 * Create a SIP participant for outbound calling
 * POST /api/v1/livekit/outbound-calls/create-participant
 */
router.post('/create-participant', authenticateToken, async (req, res) => {
  try {
    const {
      outboundTrunkId,
      phoneNumber,
      roomName,
      participantIdentity,
      participantName,
      assistantId,
      campaignId,
      contactName,
      waitUntilAnswered = true,
      playDialtone = false,
      krispEnabled = true
    } = req.body;

    if (!outboundTrunkId || !phoneNumber || !roomName) {
      return res.status(400).json({
        success: false,
        message: 'outboundTrunkId, phoneNumber, and roomName are required'
      });
    }

    const result = await livekitOutboundService.createSipParticipant({
      outboundTrunkId,
      phoneNumber,
      roomName,
      participantIdentity,
      participantName,
      assistantId,
      campaignId,
      contactName,
      waitUntilAnswered,
      playDialtone,
      krispEnabled
    });

    res.json(result);

  } catch (error) {
    console.error('Error creating SIP participant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create SIP participant',
      error: error.message
    });
  }
});

/**
 * Get outbound trunk for an assistant
 * GET /api/v1/livekit/outbound-calls/trunk/:assistantId
 */
router.get('/trunk/:assistantId', authenticateToken, async (req, res) => {
  try {
    const { assistantId } = req.params;

    const result = await livekitOutboundService.getOutboundTrunkForAssistant(assistantId);

    res.json(result);

  } catch (error) {
    console.error('Error getting outbound trunk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get outbound trunk',
      error: error.message
    });
  }
});

/**
 * List all outbound trunks
 * GET /api/v1/livekit/outbound-calls/trunks
 */
router.get('/trunks', authenticateToken, async (req, res) => {
  try {
    const result = await livekitOutboundService.listOutboundTrunks();

    res.json(result);

  } catch (error) {
    console.error('Error listing outbound trunks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list outbound trunks',
      error: error.message
    });
  }
});

/**
 * Create outbound trunk for assistant
 * POST /api/v1/livekit/outbound-calls/create-trunk
 */
router.post('/create-trunk', authenticateToken, async (req, res) => {
  try {
    const { assistantId, phoneNumber } = req.body;
    const userId = req.user?.id; // Get userId from authenticated user

    if (!assistantId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'assistantId and phoneNumber are required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication required'
      });
    }

    console.log(`🚀 Creating outbound trunk for user: ${userId}, assistant: ${assistantId}, phone: ${phoneNumber}`);

    const result = await livekitOutboundService.createOutboundTrunkForAssistant(assistantId, phoneNumber, userId);

    res.json(result);

  } catch (error) {
    console.error('Error creating outbound trunk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create outbound trunk',
      error: error.message
    });
  }
});

/**
 * Create complete outbound call setup
 * POST /api/v1/livekit/outbound-calls/create-call
 */
router.post('/create-call', authenticateToken, async (req, res) => {
  try {
    const {
      assistantId,
      campaignId,
      phoneNumber,
      contactName,
      campaignPrompt
    } = req.body;
    const userId = req.user?.id; // Get userId from authenticated user

    if (!assistantId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'assistantId and phoneNumber are required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication required'
      });
    }

    console.log(`🚀 Creating outbound call for user: ${userId}, assistant: ${assistantId}, phone: ${phoneNumber}`);

    const result = await livekitOutboundService.createOutboundCall({
      assistantId,
      campaignId,
      phoneNumber,
      contactName,
      campaignPrompt,
      userId
    });

    res.json(result);

  } catch (error) {
    console.error('Error creating outbound call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create outbound call',
      error: error.message
    });
  }
});

/**
 * Dispatch agent to room
 * POST /api/v1/livekit/outbound-calls/dispatch-agent
 */
router.post('/dispatch-agent', authenticateToken, async (req, res) => {
  try {
    const {
      roomName,
      assistantId,
      campaignId,
      contactInfo
    } = req.body;

    if (!roomName || !assistantId) {
      return res.status(400).json({
        success: false,
        message: 'roomName and assistantId are required'
      });
    }

    const result = await livekitOutboundService.dispatchAgentToRoom(
      roomName,
      assistantId,
      campaignId,
      contactInfo
    );

    res.json(result);

  } catch (error) {
    console.error('Error dispatching agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch agent',
      error: error.message
    });
  }
});

export default router;

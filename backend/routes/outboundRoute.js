// routes/outboundRoute.js
import express from 'express';
import { outboundCallsService } from '#services/outbound-calls-service.js';
import { livekitOutboundService } from '#services/livekit-outbound-service.js';
import { campaignEngine } from '#services/campaign-execution-engine.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const router = express.Router();

/**
 * Initiate outbound call for campaign
 * POST /api/v1/outbound-calls/initiate
 */
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const {
      campaignId,
      phoneNumber,
      contactName,
      assistantId,
      fromNumber
    } = req.body;
    const userId = req.user?.userId;

    if (!campaignId || !phoneNumber || !assistantId) {
      return res.status(400).json({
        success: false,
        message: 'campaignId, phoneNumber, and assistantId are required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const result = await outboundCallsService.initiateOutboundCall({
      campaignId,
      phoneNumber,
      contactName,
      assistantId,
      fromNumber,
      userId
    });

    res.json(result);

  } catch (error) {
    console.error('Error initiating outbound call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate outbound call',
      error: error.message
    });
  }
});

/**
 * Twilio call status callback
 * POST /api/v1/outbound-calls/status-callback
 */
router.post('/status-callback', async (req, res) => {
  try {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      To,
      From,
      Direction
    } = req.body;

    const result = await outboundCallsService.handleStatusCallback({
      CallSid,
      CallStatus,
      CallDuration,
      To,
      From,
      Direction
    });

    res.json(result);

  } catch (error) {
    console.error('Error processing call status callback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process callback' 
    });
  }
});

/**
 * Get campaign call details
 * GET /api/v1/outbound-calls/campaign/:campaignId
 */
router.get('/campaign/:campaignId', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    const result = await outboundCallsService.getCampaignCalls(campaignId, {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(result);

  } catch (error) {
    console.error('Error fetching campaign calls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign calls'
    });
  }
});

/**
 * Update call outcome
 * PUT /api/v1/outbound-calls/:callId/outcome
 */
router.put('/:callId/outcome', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { outcome, notes } = req.body;

    const result = await outboundCallsService.updateCallOutcome(callId, outcome, notes);

    res.json(result);

  } catch (error) {
    console.error('Error updating call outcome:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update call outcome'
    });
  }
});

/**
 * Get campaign statistics
 * GET /api/v1/outbound-calls/campaign/:campaignId/stats
 */
router.get('/campaign/:campaignId/stats', authenticateToken, async (req, res) => {
  try {
    const { campaignId } = req.params;

    const result = await outboundCallsService.getCampaignStats(campaignId);

    res.json(result);

  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign stats'
    });
  }
});

export default router;

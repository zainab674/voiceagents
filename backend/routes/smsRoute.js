// routes/smsRoute.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { SMSAssistantService } from '../services/sms-assistant-service.js';
import { SMSDatabaseService } from '../services/sms-database-service.js';
import { SMSAIService } from '../services/sms-ai-service.js';
import { sendSMS, getSMSMessages, smsWebhook, smsStatusCallback, getSMSStats, getSMSNumbers } from '../controllers/smsController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const smsDatabaseService = new SMSDatabaseService(supabase);
const smsAIService = new SMSAIService();
// SMSAssistantService now uses user-specific credentials dynamically
const smsAssistantService = new SMSAssistantService(smsDatabaseService, smsAIService, null);

// SMS Routes
router.post('/send', authenticateToken, sendSMS);
router.get('/conversation/:conversationId', authenticateToken, getSMSMessages);
router.get('/stats', authenticateToken, getSMSStats);
router.get('/numbers', authenticateToken, getSMSNumbers);
router.post('/webhook', smsWebhook);
router.post('/status-callback', smsStatusCallback);

// Health check endpoint
router.get('/webhook/health', (req, res) => {
  res.status(200).json({ status: 'SMS webhook is running' });
});

// Test SMS endpoint
router.post('/test', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'phoneNumber and message are required' 
      });
    }

    const result = await smsAssistantService.testSMS(phoneNumber, message);
    res.json(result);
    
  } catch (error) {
    console.error('Error testing SMS:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error testing SMS',
      error: error.message 
    });
  }
});

export default router;

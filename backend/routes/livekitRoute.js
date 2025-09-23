import express from "express";
import { createToken } from "#controllers/livekitController.js";
import { createAssistantTrunk } from "#services/livekitSipService.js";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

router.route("/create-token").post(createToken);

// Assistant resolver endpoints for LiveKit
router.get("/assistant/:assistantId", async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    if (!assistantId) {
      return res.status(400).json({
        success: false,
        message: 'Assistant ID is required'
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase configuration missing'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch assistant with knowledge_base_id
    const { data: assistant, error } = await supabase
      .from('agents')
      .select('id, name, prompt, first_message, cal_api_key, cal_event_type_id, cal_timezone, user_id, knowledge_base_id')
      .eq('id', assistantId)
      .single();

    if (error) {
      console.error('Error fetching assistant:', error);
      return res.status(404).json({
        success: false,
        message: 'Assistant not found'
      });
    }

    if (!assistant) {
      return res.status(404).json({
        success: false,
        message: 'Assistant not found'
      });
    }

    res.json({
      success: true,
      assistant: {
        id: assistant.id,
        name: assistant.name,
        prompt: assistant.prompt,
        firstMessage: assistant.first_message
      },
      cal_api_key: assistant.cal_api_key,
      cal_event_type_id: assistant.cal_event_type_id,
      cal_timezone: assistant.cal_timezone,
      knowledge_base_id: assistant.knowledge_base_id // Include knowledge_base_id
    });

  } catch (error) {
    console.error('Error in assistant resolver:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Assistant resolver by phone number
router.get("/assistant/by-number", async (req, res) => {
  try {
    const { number } = req.query;
    
    if (!number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase configuration missing'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch phone number and associated assistant with knowledge_base_id
    const { data: phoneData, error: phoneError } = await supabase
      .from('phone_numbers')
      .select(`
        id,
        phone_number,
        agent_id,
        agents!inner(
          id,
          name,
          prompt,
          first_message,
          cal_api_key,
          cal_event_type_id,
          cal_timezone,
          user_id,
          knowledge_base_id
        )
      `)
      .eq('phone_number', number)
      .single();

    if (phoneError || !phoneData) {
      console.error('Error fetching phone number:', phoneError);
      return res.status(404).json({
        success: false,
        message: 'Phone number not found or no associated assistant'
      });
    }

    const assistant = phoneData.agents;

    res.json({
      success: true,
      assistant: {
        id: assistant.id,
        name: assistant.name,
        prompt: assistant.prompt,
        firstMessage: assistant.first_message
      },
      cal_api_key: assistant.cal_api_key,
      cal_event_type_id: assistant.cal_event_type_id,
      cal_timezone: assistant.cal_timezone,
      knowledge_base_id: assistant.knowledge_base_id // Include knowledge_base_id
    });

  } catch (error) {
    console.error('Error in assistant resolver by number:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create assistant trunk (inbound + outbound)
router.post("/assistant-trunk", authenticateToken, async (req, res) => {
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

    res.json(result);

  } catch (error) {
    console.error('Error creating assistant trunk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assistant trunk',
      error: error.message
    });
  }
});

export default router;
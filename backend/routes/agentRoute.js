import express from "express";
import { authenticateToken } from "#middlewares/authMiddleware.js";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = express.Router();

// Test endpoint to verify authentication
router.get("/test", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Authentication working!",
      user: req.user
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: "Test endpoint error"
    });
  }
});

// Create a new agent
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, description, prompt } = req.body;
    const userId = req.user.userId;

    console.log('Creating agent for user:', userId);
    console.log('Agent data:', { name, description, prompt });

    if (!name || !description || !prompt) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and prompt are required"
      });
    }

    const { data, error } = await supabase
      .from('agents')
      .insert([
        {
          name: name.trim(),
          description: description.trim(),
          prompt: prompt.trim(),
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to create agent",
        error: error.message
      });
    }

    console.log('Agent created successfully:', data[0]);

    res.status(201).json({
      success: true,
      message: "Agent created successfully",
      data: {
        agent: data[0]
      }
    });

  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Get all agents for a user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch agents"
      });
    }

    res.json({
      success: true,
      data: {
        agents: data || []
      }
    });

  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Get a specific agent by ID
router.get("/:agentId", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.userId;

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch agent"
      });
    }

    res.json({
      success: true,
      data: {
        agent: data
      }
    });

  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Update an agent
router.put("/:agentId", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { name, description, prompt } = req.body;
    const userId = req.user.userId;

    if (!name || !description || !prompt) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and prompt are required"
      });
    }

    const { data, error } = await supabase
      .from('agents')
      .update({
        name: name.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to update agent"
      });
    }

    res.json({
      success: true,
      message: "Agent updated successfully",
      data: {
        agent: data
      }
    });

  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Delete an agent
router.delete("/:agentId", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.userId;

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', agentId)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete agent"
      });
    }

    res.json({
      success: true,
      message: "Agent deleted successfully"
    });

  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

export default router;

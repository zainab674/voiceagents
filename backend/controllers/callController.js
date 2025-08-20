import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Start a new call
export const startCall = async (req, res) => {
  try {
    const { agentId, contactName, contactPhone } = req.body;
    const userId = req.user.userId;

    console.log('Starting call recording:', { agentId, userId, contactName, contactPhone });

    const { data, error } = await supabase
      .from('calls')
      .insert([{
        agent_id: agentId,
        user_id: userId,
        contact_name: contactName || 'Unknown',
        contact_phone: contactPhone || null,
        status: 'in-progress',
        started_at: new Date().toISOString(),
        success: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error starting call:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to start call recording"
      });
    }

    console.log('Call recording started successfully:', data.id);

    res.json({
      success: true,
      data: { callId: data.id }
    });

  } catch (error) {
    console.error('Start call error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// End a call
export const endCall = async (req, res) => {
  try {
    const { callId, outcome, success, notes } = req.body;
    const userId = req.user.userId;

    console.log('Ending call recording:', { callId, userId, outcome, success });

    const { data, error } = await supabase
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        outcome: outcome || 'completed',
        success: success || false,
        notes: notes || null
      })
      .eq('id', callId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error ending call:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to end call recording"
      });
    }

    console.log('Call recording ended successfully:', data.id);

    res.json({
      success: true,
      data: { call: data }
    });

  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get call history for a user
export const getCallHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('calls')
      .select(`
        *,
        agents(name, description)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching call history:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch call history"
      });
    }

    res.json({
      success: true,
      data: { calls: data || [] }
    });

  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

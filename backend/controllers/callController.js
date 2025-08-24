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

    // Idempotency: if an in-progress call exists for this user+agent in the last 2 minutes, reuse it
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: existing, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('status', 'in-progress')
      .gte('started_at', twoMinutesAgo)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.warn('Find existing in-progress call error (non-fatal):', findError);
    }

    if (existing && existing.id) {
      console.log('Reusing existing in-progress call:', existing.id);
      return res.json({ success: true, data: { callId: existing.id, reused: true } });
    }

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

// Log an appointment booking (marks call as booked/successful or creates one)
export const logAppointment = async (req, res) => {
  try {
    const {
      callId,
      agentId,
      cal_booking_id,
      attendee_name,
      attendee_email,
      attendee_phone,
      appointment_time,
      notes,
      cal_booking_uid,
      meeting_url,
      status
    } = req.body;
    const userId = req.user.userId;

    const bookingPayload = {
      cal_booking_id,
      cal_booking_uid,
      attendee_name,
      attendee_email,
      attendee_phone,
      appointment_time,
      meeting_url,
      status: status || 'confirmed'
    };

    if (callId) {
      // Update existing call record
      const { data, error } = await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          outcome: 'booked',
          success: true,
          contact_name: attendee_name || 'Appointment',
          contact_phone: attendee_phone || null,
          notes: JSON.stringify({ appointment: bookingPayload, notes: notes || null })
        })
        .eq('id', callId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error logging appointment on existing call:', error);
        return res.status(500).json({ success: false, message: 'Failed to log appointment' });
      }

      return res.json({ success: true, data: { call: data } });
    }

    // No callId provided, create a new call entry marked as booked
    if (!agentId) {
      return res.status(400).json({ success: false, message: 'agentId is required when callId is not provided' });
    }

    const { data, error } = await supabase
      .from('calls')
      .insert([
        {
          agent_id: agentId,
          user_id: userId,
          contact_name: attendee_name || 'Appointment',
          contact_phone: attendee_phone || null,
          status: 'completed',
          started_at: appointment_time ? new Date(appointment_time).toISOString() : new Date().toISOString(),
          ended_at: new Date().toISOString(),
          outcome: 'booked',
          success: true,
          notes: JSON.stringify({ appointment: bookingPayload, notes: notes || null })
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating booked call:', error);
      return res.status(500).json({ success: false, message: 'Failed to log appointment' });
    }

    return res.json({ success: true, data: { call: data } });
  } catch (error) {
    console.error('Log appointment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
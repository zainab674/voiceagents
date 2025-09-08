import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getCallRecordingInfo as getTwilioRecordingInfo } from '#services/twilioMainTrunkService.js';

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
    const { callId, outcome, success, notes, transcription } = req.body;
    const userId = req.user.userId;

    console.log('Ending call recording:', { callId, userId, outcome, success, transcriptionLength: transcription?.length || 0 });

    // Calculate duration if we have start time
    let duration_seconds = 0;
    if (req.body.duration_seconds) {
      duration_seconds = req.body.duration_seconds;
    } else {
      // Try to calculate from start/end times
      const { data: existingCall } = await supabase
        .from('calls')
        .select('started_at')
        .eq('id', callId)
        .single();
      
      if (existingCall?.started_at) {
        const startTime = new Date(existingCall.started_at);
        const endTime = new Date();
        duration_seconds = Math.floor((endTime - startTime) / 1000);
      }
    }

    const updateData = {
      status: 'completed',
      ended_at: new Date().toISOString(),
      outcome: outcome || 'completed',
      success: success || false,
      notes: notes || null,
      duration_seconds: duration_seconds
    };

    // Add transcription if provided
    if (transcription && Array.isArray(transcription)) {
      updateData.transcription = transcription;
    }

    const { data, error } = await supabase
      .from('calls')
      .update(updateData)
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

// Save transcription data during a call
export const saveTranscription = async (req, res) => {
  try {
    const { callId, transcription } = req.body;
    const userId = req.user.userId;

    console.log('Saving transcription:', { callId, userId, transcriptionLength: transcription?.length || 0 });

    if (!transcription || !Array.isArray(transcription)) {
      return res.status(400).json({
        success: false,
        message: "Transcription must be an array"
      });
    }

    const { data, error } = await supabase
      .from('calls')
      .update({
        transcription: transcription
      })
      .eq('id', callId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error saving transcription:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to save transcription"
      });
    }

    console.log('Transcription saved successfully:', data.id);

    res.json({
      success: true,
      data: { call: data }
    });

  } catch (error) {
    console.error('Save transcription error:', error);
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

// Get recording information for a call
export const getCallRecordingInfo = async (req, res) => {
  try {
    console.log('getCallRecordingInfo called with params:', req.params);
    console.log('getCallRecordingInfo called with user:', req.user);
    
    const userId = req.user.userId;
    const { callSid } = req.params;
    
    if (!callSid) {
      console.log('No callSid provided');
      return res.status(400).json({ 
        success: false, 
        message: 'callSid is required' 
      });
    }

    // Get user's Twilio credentials
    const { data: credentials, error: credError } = await supabase
      .from('user_twilio_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (credError || !credentials) {
      return res.status(400).json({ 
        success: false, 
        message: 'No Twilio credentials found' 
      });
    }

    // Get recording info from Twilio
    const result = await getTwilioRecordingInfo({
      accountSid: credentials.account_sid,
      authToken: credentials.auth_token,
      callSid
    });

    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Get call recording info error:', error);
    res.status(500).json({ 
      success: false, 
      message: error?.message || 'Failed to get call recording info' 
    });
  }
};

// Get recording audio file (proxy endpoint)
export const getRecordingAudio = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { recordingSid } = req.params;
    const { accountSid, authToken } = req.query;

    if (!recordingSid || !accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        message: 'recordingSid, accountSid, and authToken are required'
      });
    }

    // Verify user has access to these credentials
    const { data: credentials, error: credError } = await supabase
      .from('user_twilio_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('account_sid', accountSid)
      .eq('is_active', true)
      .single();
    
    if (credError || !credentials) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid credentials' 
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
};
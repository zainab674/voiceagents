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
    const { name, description, prompt, smsPrompt, firstMessage, calApiKey, calEventTypeSlug, calTimezone, calEventTypeId, calEventTitle, calEventLength } = req.body;
    const userId = req.user.userId;

    console.log('Creating agent for user:', userId);
    console.log('Agent data:', { name, description, prompt, smsPrompt, firstMessage, calApiKey: calApiKey ? '***' : null, calEventTypeSlug, calTimezone, calEventTypeId, calEventTitle, calEventLength });

    if (!name || !description || !prompt) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and prompt are required"
      });
    }

    let finalEventTypeId = calEventTypeId || null;
    let finalEventTypeSlug = calEventTypeSlug || null;
    let finalTimezone = calTimezone || 'UTC';

    // If a Cal API key is provided but no event type id, create one via v2 (use provided slug if any)
    if (calApiKey && !finalEventTypeId) {
      try {
        const CalService = (await import('../services/calService.js')).default;
        const calendarService = new CalService(calApiKey, null, finalTimezone, null);
        const baseSlug = (finalEventTypeSlug || name || 'voice-agent-meeting')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const title = calEventTitle || `${name} Meeting`;
        const lengthInMinutes = Number(calEventLength) || 30;
        const resp = await calendarService.createEventTypeV2({ title, slug: baseSlug, lengthInMinutes });
        if (resp?.status === 'success' && resp?.data?.id) {
          finalEventTypeId = String(resp.data.id);
          finalEventTypeSlug = resp.data.slug || baseSlug;
          console.log('Created Cal.com event type', resp.data);
        } else {
          console.warn('Cal.com create event type did not return success', resp);
        }
      } catch (e) {
        console.error('Failed to create Cal.com event type:', e?.response?.data || e.message);
      }
    }

    const { data, error } = await supabase
      .from('agents')
      .insert([
        {
          name: name.trim(),
          description: description.trim(),
          prompt: prompt.trim(),
          sms_prompt: smsPrompt ? smsPrompt.trim() : null,
          first_message: firstMessage ? firstMessage.trim() : null,
          user_id: userId,
          cal_api_key: calApiKey || null,
          cal_event_type_slug: finalEventTypeSlug || null,
          cal_event_type_id: finalEventTypeId || null,
          cal_timezone: finalTimezone,
          cal_enabled: !!calApiKey,
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
      .select('id, name, description, created_at')
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
    const { name, description, prompt, smsPrompt, firstMessage, calApiKey, calEventTypeSlug, calEventTypeId, calTimezone } = req.body;
    const userId = req.user.userId;

    if (!name || !description || !prompt) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and prompt are required"
      });
    }

    let finalEventTypeId = calEventTypeId || null;
    let finalEventTypeSlug = calEventTypeSlug || null;
    let finalTimezone = calTimezone || 'UTC';

    // If a Cal API key is provided but no event type id, create one via v2 (use provided slug if any)
    if (calApiKey && !finalEventTypeId) {
      try {
        const CalService = (await import('../services/calService.js')).default;
        const calendarService = new CalService(calApiKey, null, finalTimezone, null);
        const baseSlug = (finalEventTypeSlug || name || 'voice-agent-meeting')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const title = `${name} Meeting`;
        const lengthInMinutes = 30;
        const resp = await calendarService.createEventTypeV2({ title, slug: baseSlug, lengthInMinutes });
        if (resp?.status === 'success' && resp?.data?.id) {
          finalEventTypeId = String(resp.data.id);
          finalEventTypeSlug = resp.data.slug || baseSlug;
          console.log('Created Cal.com event type for edit', resp.data);
        } else {
          console.warn('Cal.com create event type did not return success', resp);
        }
      } catch (e) {
        console.error('Failed to create Cal.com event type during edit:', e?.response?.data || e.message);
      }
    }

    const { data, error } = await supabase
      .from('agents')
      .update({
        name: name.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        sms_prompt: smsPrompt ? smsPrompt.trim() : null,
        first_message: firstMessage ? firstMessage.trim() : null,
        cal_api_key: calApiKey || null,
        cal_event_type_slug: finalEventTypeSlug || null,
        cal_event_type_id: finalEventTypeId || null,
        cal_timezone: finalTimezone,
        cal_enabled: !!(calApiKey && finalEventTypeSlug),
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

// Book an appointment for an agent
router.post("/:agentId/calendar/book", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { slotId, startTime, attendeeName, attendeeEmail, attendeePhone, notes } = req.body;
    const userId = req.user.userId;

    // Validate required parameters
    if (!slotId || !startTime || !attendeeName || !attendeeEmail) {
      return res.status(400).json({
        success: false,
        message: "slotId, startTime, attendeeName, and attendeeEmail are required"
      });
    }

    // Get the agent to check if calendar is enabled
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError) {
      if (agentError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }
      console.error('Supabase error:', agentError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch agent"
      });
    }

    // Check if calendar is enabled for this agent
    if (!agent.cal_enabled || !agent.cal_api_key || !agent.cal_event_type_slug) {
      return res.status(400).json({
        success: false,
        message: "Calendar integration is not enabled for this agent"
      });
    }

    // Import the Cal.com service
    const CalService = (await import('../services/calService.js')).default;

    // Create calendar service instance
    const calendarService = new CalService(
      agent.cal_api_key,
      agent.cal_event_type_slug,
      agent.cal_timezone || 'UTC',
      agent.cal_event_type_id // Pass the event type ID like Urban does
    );

    // Book the appointment with Cal.com using Urban-style service
    console.log('AgentRoute: Received booking request:', { slotId, startTime, attendeeName, attendeeEmail, attendeePhone, notes });
    console.log('AgentRoute: Booking appointment with Cal.com service...');

    // Validate startTime format
    if (!startTime || isNaN(new Date(startTime).getTime())) {
      throw new Error(`Invalid startTime format: ${startTime}. Expected ISO string or valid date.`);
    }

    const calResponse = await calendarService.bookAppointment({
      startTime: startTime, // Use the actual startTime from request body
      attendeeName,
      attendeeEmail,
      attendeePhone,
      notes
    });

    console.log('AgentRoute: Cal.com booking response:', calResponse);

    // Return the actual Cal.com response
    res.json({
      success: true,
      message: "Appointment booked successfully",
      data: {
        calResponse: calResponse,  // Include actual Cal.com response
        slotId,
        attendeeName,
        attendeeEmail,
        attendeePhone,
        notes
      }
    });

  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get available calendar slots for an agent
router.get("/:agentId/calendar/slots", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;
    const userId = req.user.userId;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required query parameters"
      });
    }

    // Get the agent to check if calendar is enabled
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError) {
      if (agentError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }
      console.error('Supabase error:', agentError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch agent"
      });
    }

    // Check if calendar is enabled for this agent
    if (!agent.cal_enabled || !agent.cal_api_key || !agent.cal_event_type_slug) {
      return res.status(400).json({
        success: false,
        message: "Calendar integration is not enabled for this agent"
      });
    }

    let formattedSlots = [];

    try {
      const CalService = (await import('../services/calService.js')).default;
      const calendarService = new CalService(
        agent.cal_api_key,
        agent.cal_event_type_slug,
        agent.cal_timezone || 'UTC',
        agent.cal_event_type_id
      );

      // Use /v2/slots with eventTypeId if available
      const resp = await calendarService.getSlotsByEventType({
        startISO: String(startDate),
        endISO: String(endDate),
        eventTypeId: agent.cal_event_type_id ? Number(agent.cal_event_type_id) : undefined,
        duration: 30,
        format: 'time'
      });

      // Transform Cal.com v2 response into existing array shape
      // resp.data can be either map { 'YYYY-MM-DD': [ 'ISO', ... ] } or { data: {...} }
      const slotsMap = resp?.data ?? resp; // support both
      const slotsArray = [];
      for (const [dateKey, times] of Object.entries(slotsMap)) {
        if (Array.isArray(times)) {
          for (const start of times) {
            const startISO = typeof start === 'string' ? start : start?.start || start?.time || null;
            if (!startISO) continue;
            slotsArray.push({
              id: `CS_${Date.parse(startISO).toString(36)}`,
              start_time: startISO,
              duration_min: 30,
              local_time: new Date(startISO).toLocaleString()
            });
          }
        }
      }
      formattedSlots = slotsArray.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      console.log(`Successfully transformed ${formattedSlots.length} slots`);

    } catch (error) {
      console.error('Error fetching slots via eventTypeId:', error?.response?.data || error.message);
      throw new Error(`Calendar service error: ${error.message}`);
    }

    res.json({
      success: true,
      data: {
        slots: formattedSlots,
        agent: {
          id: agent.id,
          name: agent.name,
          timezone: agent.cal_timezone,
          cal_enabled: agent.cal_enabled,
          cal_api_key: agent.cal_api_key,
          cal_event_type_slug: agent.cal_event_type_slug,
          cal_event_type_id: agent.cal_event_type_id
        }
      }
    });

  } catch (error) {
    console.error('Get calendar slots error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get a specific event type by ID (v2)
router.get("/:agentId/calendar/event-type/:eventTypeId", authenticateToken, async (req, res) => {
  try {
    const { agentId, eventTypeId } = req.params;
    const userId = req.user.userId;

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError) {
      return res.status(agentError.code === 'PGRST116' ? 404 : 500).json({
        success: false,
        message: agentError.code === 'PGRST116' ? 'Agent not found' : 'Failed to fetch agent'
      });
    }

    if (!agent.cal_api_key) {
      return res.status(400).json({ success: false, message: 'Cal.com API key not configured for this agent' });
    }

    const CalService = (await import('../services/calService.js')).default;
    const calendarService = new CalService(agent.cal_api_key, agent.cal_event_type_slug, agent.cal_timezone || 'UTC', agent.cal_event_type_id);

    const data = await calendarService.getEventTypeById(eventTypeId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get event type error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Get current Cal.com profile (v2)
router.get("/:agentId/calendar/me", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.userId;

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError) {
      return res.status(agentError.code === 'PGRST116' ? 404 : 500).json({
        success: false,
        message: agentError.code === 'PGRST116' ? 'Agent not found' : 'Failed to fetch agent'
      });
    }

    if (!agent.cal_api_key) {
      return res.status(400).json({ success: false, message: 'Cal.com API key not configured for this agent' });
    }

    const CalService = (await import('../services/calService.js')).default;
    const calendarService = new CalService(agent.cal_api_key, agent.cal_event_type_slug, agent.cal_timezone || 'UTC', agent.cal_event_type_id);

    const data = await calendarService.getMyProfile();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Get available slots via Cal.com v2
router.get("/:agentId/calendar/slots-v2", authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { start, end, eventTypeId, username, duration, format } = req.query;
    const userId = req.user.userId;

    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'start and end are required ISO strings' });
    }

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError) {
      return res.status(agentError.code === 'PGRST116' ? 404 : 500).json({
        success: false,
        message: agentError.code === 'PGRST116' ? 'Agent not found' : 'Failed to fetch agent'
      });
    }

    if (!agent.cal_api_key) {
      return res.status(400).json({ success: false, message: 'Cal.com API key not configured for this agent' });
    }

    const CalService = (await import('../services/calService.js')).default;
    const calendarService = new CalService(agent.cal_api_key, agent.cal_event_type_slug, agent.cal_timezone || 'UTC', agent.cal_event_type_id);

    const data = await calendarService.getSlotsByEventType({
      startISO: String(start),
      endISO: String(end),
      eventTypeId: eventTypeId ? Number(eventTypeId) : undefined,
      username: username ? String(username) : undefined,
      duration: duration ? Number(duration) : undefined,
      format: format ? String(format) : undefined,
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get v2 slots error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});


export default router;

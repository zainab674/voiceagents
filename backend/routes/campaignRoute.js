// routes/campaignRoute.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { campaignEngine } from '#services/campaign-execution-engine.js';
import { authenticateToken } from '#middlewares/authMiddleware.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = express.Router();

/**
 * Get all campaigns for user
 * GET /api/v1/campaigns
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('campaigns')
      .select(`
        *,
        agents(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('execution_status', status);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      throw error;
    }

    // Format campaigns for frontend
    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      assistant_id: campaign.assistant_id,
      assistant_name: campaign.agents?.name || 'Unknown',
      contact_source: campaign.contact_source,
      contact_list_id: campaign.contact_list_id,
      csv_file_id: campaign.csv_file_id,
      daily_cap: campaign.daily_cap,
      calling_days: campaign.calling_days,
      start_hour: campaign.start_hour,
      end_hour: campaign.end_hour,
      campaign_prompt: campaign.campaign_prompt,
      execution_status: campaign.execution_status,
      next_call_at: campaign.next_call_at,
      current_daily_calls: campaign.current_daily_calls,
      total_calls_made: campaign.total_calls_made,
      total_calls_answered: campaign.total_calls_answered,
      dials: campaign.dials,
      pickups: campaign.pickups,
      interested: campaign.interested,
      not_interested: campaign.not_interested,
      callback: campaign.callback,
      do_not_call: campaign.do_not_call,
      total_usage: campaign.total_usage,
      last_execution_at: campaign.last_execution_at,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at
    }));

    res.json({
      success: true,
      campaigns: formattedCampaigns
    });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaigns'
    });
  }
});

/**
 * Create new campaign
 * POST /api/v1/campaigns
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      assistantId,
      contactSource,
      contactListId,
      csvFileId,
      dailyCap,
      callingDays,
      startHour,
      endHour,
      campaignPrompt
    } = req.body;

    // Infer contactSource from csvFileId or contactListId if not provided
    let inferredContactSource = contactSource;
    if (!inferredContactSource) {
      if (csvFileId) {
        inferredContactSource = 'csv_file';
      } else if (contactListId) {
        inferredContactSource = 'contact_list';
      }
    }

    if (!name || !assistantId || !inferredContactSource) {
      return res.status(400).json({
        success: false,
        message: 'name, assistantId, and contactSource (or csvFileId/contactListId) are required'
      });
    }

    // Get assistant name
    const { data: assistant, error: assistantError } = await supabase
      .from('agents')
      .select('name')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      return res.status(400).json({
        success: false,
        message: 'Assistant not found'
      });
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name,
        assistant_id: assistantId,
        assistant_name: assistant.name,
        contact_source: inferredContactSource,
        contact_list_id: contactListId || null,
        csv_file_id: csvFileId || null,
        daily_cap: dailyCap || 100,
        calling_days: callingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        start_hour: startHour !== undefined ? startHour : 9,
        end_hour: endHour !== undefined ? endHour : 17,
        campaign_prompt: campaignPrompt || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create campaign'
    });
  }
});

/**
 * Get campaign by ID
 * GET /api/v1/campaigns/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        agents(name)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign'
    });
  }
});

/**
 * Update campaign
 * PUT /api/v1/campaigns/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.user_id;
    delete updateData.created_at;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update campaign'
    });
  }
});

/**
 * Delete campaign
 * DELETE /api/v1/campaigns/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete campaign'
    });
  }
});

/**
 * Start campaign
 * POST /api/v1/campaigns/:id/start
 */
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, execution_status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.execution_status === 'running') {
      return res.status(400).json({
        success: false,
        message: 'Campaign is already running'
      });
    }

    await campaignEngine.startCampaign(id);

    res.json({
      success: true,
      message: 'Campaign started successfully'
    });

  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start campaign'
    });
  }
});

/**
 * Pause campaign
 * POST /api/v1/campaigns/:id/pause
 */
router.post('/:id/pause', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, execution_status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.execution_status !== 'running') {
      return res.status(400).json({
        success: false,
        message: 'Campaign is not running'
      });
    }

    await campaignEngine.pauseCampaign(id, 'Manually paused by user');

    res.json({
      success: true,
      message: 'Campaign paused successfully'
    });

  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause campaign'
    });
  }
});

/**
 * Resume campaign
 * POST /api/v1/campaigns/:id/resume
 */
router.post('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, execution_status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.execution_status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Campaign is not paused'
      });
    }

    await campaignEngine.startCampaign(id);

    res.json({
      success: true,
      message: 'Campaign resumed successfully'
    });

  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume campaign'
    });
  }
});

/**
 * Stop campaign
 * POST /api/v1/campaigns/:id/stop
 */
router.post('/:id/stop', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, execution_status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (!['running', 'paused'].includes(campaign.execution_status)) {
      return res.status(400).json({
        success: false,
        message: 'Campaign is not running or paused'
      });
    }

    await campaignEngine.completeCampaign(id);

    res.json({
      success: true,
      message: 'Campaign stopped successfully'
    });

  } catch (error) {
    console.error('Error stopping campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop campaign'
    });
  }
});

/**
 * Get campaign status and statistics
 * GET /api/v1/campaigns/:id/status
 */
router.get('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        agents(name)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get campaign calls statistics
    const { data: calls, error: callsError } = await supabase
      .from('campaign_calls')
      .select('status, outcome, call_duration')
      .eq('campaign_id', id);

    if (callsError) {
      throw callsError;
    }

    const stats = {
      total: calls.length,
      completed: calls.filter(c => c.status === 'completed').length,
      failed: calls.filter(c => c.status === 'failed').length,
      answered: calls.filter(c => c.status === 'answered' || c.status === 'completed').length,
      noAnswer: calls.filter(c => c.outcome === 'no_answer').length,
      busy: calls.filter(c => c.outcome === 'busy').length,
      interested: calls.filter(c => c.outcome === 'interested').length,
      notInterested: calls.filter(c => c.outcome === 'not_interested').length,
      callback: calls.filter(c => c.outcome === 'callback').length,
      doNotCall: calls.filter(c => c.outcome === 'do_not_call').length
    };

    // Get queue status (simplified for now)
    const queueStatus = {
      queued: 0,
      processing: 0,
      completed: stats.completed,
      failed: stats.failed
    };

    res.json({
      success: true,
      campaign: {
        ...campaign,
        stats,
        queueStatus
      }
    });

  } catch (error) {
    console.error('Error fetching campaign status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign status'
    });
  }
});

export default router;

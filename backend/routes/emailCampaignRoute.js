
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '#middlewares/authMiddleware.js';
import { emailCampaignService } from '#services/email-campaign-service.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = express.Router();

// GET /api/v1/email-campaigns
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { data: campaigns, error } = await supabase
            .from('email_campaigns')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Error fetching email campaigns:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
    }
});

// POST /api/v1/email-campaigns
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, subject, body, contactSource, contactListId, csvFileId, totalCount, scheduledAt } = req.body;

        const { data: campaign, error } = await supabase
            .from('email_campaigns')
            .insert({
                user_id: userId,
                name,
                subject,
                body,
                contact_source: contactSource,
                contact_list_id: contactListId || null,
                csv_file_id: csvFileId || null,
                total_count: totalCount || 0,
                pending_count: totalCount || 0,
                status: scheduledAt ? 'scheduled' : 'draft',
                scheduled_at: scheduledAt || null
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, campaign });
    } catch (error) {
        console.error('Error creating email campaign:', error);
        res.status(500).json({ success: false, message: 'Failed to create campaign' });
    }
});

// DELETE /api/v1/email-campaigns/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const { error } = await supabase
            .from('email_campaigns')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ success: true, message: 'Campaign deleted' });
    } catch (error) {
        console.error('Error deleting email campaign:', error);
        res.status(500).json({ success: false, message: 'Failed to delete campaign' });
    }
});


// POST /api/v1/email-campaigns/:id/start
router.post('/:id/start', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // 1. Get Campaign and Check Credentials
        const { data: campaign, error } = await supabase
            .from('email_campaigns')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !campaign) throw error || new Error('Campaign not found');

        const { data: credentials, error: credError } = await supabase
            .from('user_smtp_credentials')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (credError || !credentials) {
            return res.status(400).json({ success: false, message: 'No SMTP credentials found. Please configure them in Integration tab.' });
        }

        // 2. Trigger background sending
        emailCampaignService.runCampaign(id, userId);

        res.json({ success: true, message: 'Campaign started', campaign });
    } catch (error) {
        console.error('Error starting email campaign:', error);
        res.status(500).json({ success: false, message: 'Failed to start campaign' });
    }
});

// POST /api/v1/email-campaigns/:id/pause
router.post('/:id/pause', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const { data: campaign, error } = await supabase
            .from('email_campaigns')
            .update({ status: 'paused' })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, message: 'Campaign paused', campaign });
    } catch (error) {
        console.error('Error pausing email campaign:', error);
        res.status(500).json({ success: false, message: 'Failed to pause campaign' });
    }
});

export default router;


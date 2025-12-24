
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '#middlewares/authMiddleware.js';
import nodemailer from 'nodemailer';
import { csvService } from '#services/csv-service.js';

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
        const { name, subject, body, contactSource, contactListId, csvFileId, totalCount } = req.body;

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
                status: 'draft'
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

        // 1. Get Campaign
        const { data: campaign, error } = await supabase
            .from('email_campaigns')
            .update({ status: 'running' })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        // 2. Get Credentials
        const { data: credentials, error: credError } = await supabase
            .from('user_smtp_credentials')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (credError || !credentials) {
            await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', id);
            return res.status(400).json({ success: false, message: 'No SMTP credentials found. Please configure them in Integration tab.' });
        }

        // 3. Trigger background sending (Fire and forget)
        runCampaign(campaign, credentials);

        res.json({ success: true, message: 'Campaign started', campaign });
    } catch (error) {
        console.error('Error starting email campaign:', error);
        res.status(500).json({ success: false, message: 'Failed to start campaign' });
    }
});

// Helper function to run the campaign
async function runCampaign(campaign, credentials) {
    try {
        console.log(`Starting execution for campaign ${campaign.id}`);

        const transporter = nodemailer.createTransport({
            host: credentials.host,
            port: credentials.port,
            secure: credentials.port === 465,
            auth: {
                user: credentials.username,
                pass: credentials.password,
            },
            pool: true,
            maxConnections: 5
        });

        // Fetch contacts
        let contacts = [];
        if (campaign.contact_source === 'csv' && campaign.csv_file_id) {
            // Fetch all contacts from the CSV file
            // Note: For very large lists, we should paginate. For now, fetching first 5000 approx.
            const { data: csvContacts, error: contactError } = await supabase
                .from('csv_contacts')
                .select('*')
                .eq('csv_file_id', campaign.csv_file_id)
                .order('id', { ascending: true }); // Deterministic order

            if (contactError) throw contactError;
            contacts = csvContacts;
        }

        // Logic to skip already sent? 
        // For simple implementation, we assume we continue from 'sent_count' offset if resuming?
        // But 'sent_count' might be unreliable if failed rows. 
        // Ideally we need a 'campaign_logs' table. 
        // For now, we will just start processing. 
        // TODO: Implement sophisticated resumption using a logs table.
        // CURRENT: If resuming, we might re-send to some if we don't have logs. 
        // Let's rely on an offset logic based on sent_count for now to allow basic resume.
        const startIndex = campaign.sent_count || 0;
        const contactsToProcess = contacts.slice(startIndex);

        console.log(`Processing ${contactsToProcess.length} contacts for campaign ${campaign.name}`);

        let successCount = campaign.sent_count || 0;
        let failedCount = campaign.failed_count || 0;

        for (const contact of contactsToProcess) {
            // Check if campaign is still running (in case user paused it)
            const { data: currentStatus } = await supabase
                .from('email_campaigns')
                .select('status')
                .eq('id', campaign.id)
                .single();

            if (currentStatus.status !== 'running') {
                console.log(`Campaign ${campaign.id} paused or stopped.`);
                break;
            }

            try {
                // Personalize
                let htmlBody = campaign.body
                    .replace(/{{first_name}}/g, contact.name?.split(' ')[0] || '')
                    .replace(/{{last_name}}/g, contact.name?.split(' ').slice(1).join(' ') || '')
                    .replace(/{{email}}/g, contact.email);

                const mailOptions = {
                    from: `"${credentials.from_name || credentials.username}" <${credentials.username}>`,
                    to: contact.email,
                    subject: campaign.subject,
                    html: htmlBody, // Using html property for body
                };

                await transporter.sendMail(mailOptions);
                successCount++;
            } catch (err) {
                console.error(`Failed to send to ${contact.email}:`, err);
                failedCount++;
            }

            // Update stats batch or every one? Doing every one for real-time feedback but it strains DB.
            // Let's update every 1 for now or every 5.
            await supabase.from('email_campaigns').update({
                sent_count: successCount,
                failed_count: failedCount,
                pending_count: contacts.length - (successCount + failedCount)
            }).eq('id', campaign.id);

            // Wait a bit to be nice to SMTP
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Final update
        const finalStatus = (successCount + failedCount >= contacts.length) ? 'completed' : 'paused';
        await supabase.from('email_campaigns').update({
            status: finalStatus,
            sent_count: successCount,
            failed_count: failedCount
        }).eq('id', campaign.id);

        transporter.close();

    } catch (error) {
        console.error(`Campaign execution failed for ${campaign.id}:`, error);
        await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
    }
}

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


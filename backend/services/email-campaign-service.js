
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const emailCampaignService = {
    async runCampaign(campaignId, userId) {
        try {
            console.log(`Starting execution for campaign ${campaignId}`);

            // 1. Get Campaign
            const { data: campaign, error: campaignError } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('id', campaignId)
                .single();

            if (campaignError || !campaign) throw campaignError || new Error('Campaign not found');

            // 2. Get Credentials
            const { data: credentials, error: credError } = await supabase
                .from('user_smtp_credentials')
                .select('*')
                .eq('user_id', userId || campaign.user_id)
                .single();

            if (credError || !credentials) {
                await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaignId);
                throw new Error('SMTP Setup Required: Please go to Settings > Integrations and configure your Email (SMTP) credentials to send campaigns.');
            }

            // Update status to running
            await supabase.from('email_campaigns').update({ status: 'running' }).eq('id', campaignId);

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
                const { data: csvContacts, error: contactError } = await supabase
                    .from('csv_contacts')
                    .select('*')
                    .eq('csv_file_id', campaign.csv_file_id)
                    .order('id', { ascending: true });

                if (contactError) throw contactError;
                contacts = csvContacts;

                // Update total_count if it's 0 or doesn't match
                if (campaign.total_count !== contacts.length) {
                    await supabase.from('email_campaigns')
                        .update({ total_count: contacts.length })
                        .eq('id', campaignId);
                }
            }

            const startIndex = campaign.sent_count || 0;
            const contactsToProcess = contacts.slice(startIndex);

            if (contactsToProcess.length === 0) {
                console.log(`Campaign ${campaignId} already has all contacts processed.`);
                const finalStatus = (contacts.length > 0 && (campaign.sent_count + (campaign.failed_count || 0)) >= contacts.length) ? 'completed' : 'paused';
                await supabase.from('email_campaigns').update({
                    status: finalStatus,
                    pending_count: 0
                }).eq('id', campaignId);
                return;
            }

            console.log(`Processing ${contactsToProcess.length} contacts for campaign ${campaign.name}`);

            let successCount = campaign.sent_count || 0;
            let failedCount = campaign.failed_count || 0;
            let totalProcessed = successCount + failedCount;

            for (const contact of contactsToProcess) {
                // Check if campaign is still running
                const { data: currentStatus } = await supabase
                    .from('email_campaigns')
                    .select('status')
                    .eq('id', campaignId)
                    .single();

                if (currentStatus.status !== 'running') {
                    console.log(`Campaign ${campaignId} paused or stopped.`);
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
                        html: htmlBody,
                    };

                    await transporter.sendMail(mailOptions);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to send to ${contact.email}:`, err);
                    failedCount++;
                }

                totalProcessed = successCount + failedCount;
                const isFinished = totalProcessed >= contacts.length;

                await supabase.from('email_campaigns').update({
                    sent_count: successCount,
                    failed_count: failedCount,
                    pending_count: Math.max(0, contacts.length - totalProcessed),
                    status: isFinished ? 'completed' : 'running'
                }).eq('id', campaignId);

                if (isFinished) {
                    console.log(`Campaign ${campaignId} completed during loop.`);
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Final safety check/update
            const finalStatus = (totalProcessed >= contacts.length && contacts.length > 0) ? 'completed' : 'paused';

            // If it was paused or interrupted, don't overwrite with 'completed' unless actually done
            const { data: latestCampaign } = await supabase
                .from('email_campaigns')
                .select('status')
                .eq('id', campaignId)
                .single();

            if (latestCampaign?.status === 'running' || (totalProcessed >= contacts.length)) {
                await supabase.from('email_campaigns').update({
                    status: finalStatus,
                    sent_count: successCount,
                    failed_count: failedCount
                }).eq('id', campaignId);
            }

            transporter.close();

        } catch (error) {
            console.error(`Campaign execution failed for ${campaignId}:`, error);
            await supabase.from('email_campaigns').update({ status: 'failed' }).eq('id', campaignId);
        }
    }
};

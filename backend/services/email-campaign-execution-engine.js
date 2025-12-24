
import { createClient } from '@supabase/supabase-js';
import { emailCampaignService } from './email-campaign-service.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class EmailCampaignExecutionEngine {
    constructor() {
        this.isRunning = false;
        this.executionInterval = null;
        this.checkInterval = 60000; // Check every 1 minute
    }

    /**
     * Start the engine
     */
    start() {
        if (this.isRunning) {
            console.log('Email campaign execution engine is already running');
            return;
        }

        this.isRunning = true;
        console.log('Starting email campaign execution engine...');

        // Initial check
        this.checkScheduledCampaigns();

        // Set up interval
        this.executionInterval = setInterval(() => {
            this.checkScheduledCampaigns();
        }, this.checkInterval);
    }

    /**
     * Stop the engine
     */
    stop() {
        if (this.executionInterval) {
            clearInterval(this.executionInterval);
            this.executionInterval = null;
        }
        this.isRunning = false;
        console.log('Email campaign execution engine stopped');
    }

    /**
     * Check for scheduled campaigns that are ready to run
     */
    async checkScheduledCampaigns() {
        try {
            console.log('🔄 Email engine checking for scheduled campaigns...');

            const now = new Date().toISOString();

            const { data: campaigns, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .eq('status', 'scheduled')
                .lte('scheduled_at', now);

            if (error) {
                console.error('Error fetching scheduled email campaigns:', error);
                return;
            }

            if (!campaigns || campaigns.length === 0) {
                return;
            }

            console.log(`Found ${campaigns.length} email campaigns ready to execute`);

            for (const campaign of campaigns) {
                console.log(`Executing scheduled campaign: ${campaign.name} (${campaign.id})`);

                // Mark as running first to prevent double execution if check runs again before finish
                // (though runCampaign also updates status)
                await supabase
                    .from('email_campaigns')
                    .update({ status: 'running' })
                    .eq('id', campaign.id);

                // Run campaign in background
                emailCampaignService.runCampaign(campaign.id, campaign.user_id);
            }

        } catch (error) {
            console.error('Error in checkScheduledCampaigns:', error);
        }
    }
}

export const emailCampaignExecutionEngine = new EmailCampaignExecutionEngine();

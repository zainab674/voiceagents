import { MultiCRMService } from './crm-service.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * CRM Campaign Integration Service
 * Handles creating campaigns from CRM contacts and syncing results back
 */
class CRMCampaignService {
  constructor() {
    this.logger = console;
  }

  /**
   * Create campaign from CRM contacts
   * @param {string} userId - User ID
   * @param {Object} campaignData - Campaign configuration
   * @param {Array} selectedContacts - Array of CRM contact IDs
   * @returns {Promise<Object>} Campaign creation result
   */
  async createCampaignFromCRMContacts(userId, campaignData, selectedContacts) {
    try {
      this.logger.info(`Creating campaign from CRM contacts for user ${userId}`);
      
      // Get CRM contacts from database
      const { data: contacts, error: contactsError } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', userId)
        .in('id', selectedContacts);

      if (contactsError) {
        throw new Error(`Failed to fetch CRM contacts: ${contactsError.message}`);
      }

      if (!contacts || contacts.length === 0) {
        throw new Error('No CRM contacts found for selected IDs');
      }

      // Create campaign in database
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          name: campaignData.name,
          description: campaignData.description,
          assistant_id: campaignData.assistant_id,
          campaign_prompt: campaignData.campaign_prompt,
          status: 'draft',
          contact_source: 'crm',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (campaignError) {
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }

      // Create campaign calls for each contact
      const campaignCalls = contacts.map(contact => ({
        campaign_id: campaign.id,
        user_id: userId,
        contact_name: `${contact.first_name} ${contact.last_name}`.trim(),
        email: contact.email,
        phone_number: contact.phone,
        company: contact.company,
        job_title: contact.job_title,
        crm_contact_id: contact.id,
        crm_platform: contact.crm_platform,
        status: 'pending',
        created_at: new Date().toISOString()
      }));

      const { error: callsError } = await supabase
        .from('campaign_calls')
        .insert(campaignCalls);

      if (callsError) {
        // Clean up campaign if calls creation fails
        await supabase
          .from('campaigns')
          .delete()
          .eq('id', campaign.id);
        
        throw new Error(`Failed to create campaign calls: ${callsError.message}`);
      }

      this.logger.info(`Campaign created successfully with ${campaignCalls.length} contacts`);

      return {
        success: true,
        campaign: campaign,
        contactsCount: campaignCalls.length,
        contacts: campaignCalls
      };

    } catch (error) {
      this.logger.error('Error creating campaign from CRM contacts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync campaign results back to CRM
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Sync result
   */
  async syncCampaignResultsToCRM(campaignId) {
    try {
      this.logger.info(`Syncing campaign results to CRM for campaign ${campaignId}`);

      // Get campaign and its calls
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) {
        throw new Error(`Failed to fetch campaign: ${campaignError.message}`);
      }

      const { data: calls, error: callsError } = await supabase
        .from('campaign_calls')
        .select('*')
        .eq('campaign_id', campaignId)
        .not('crm_contact_id', 'is', null);

      if (callsError) {
        throw new Error(`Failed to fetch campaign calls: ${callsError.message}`);
      }

      if (!calls || calls.length === 0) {
        return {
          success: true,
          message: 'No CRM contacts to sync',
          syncedCount: 0
        };
      }

      // Group calls by CRM platform
      const callsByPlatform = calls.reduce((acc, call) => {
        if (!acc[call.crm_platform]) {
          acc[call.crm_platform] = [];
        }
        acc[call.crm_platform].push(call);
        return acc;
      }, {});

      const syncResults = {};

      // Sync to each CRM platform
      for (const [platform, platformCalls] of Object.entries(callsByPlatform)) {
        try {
          const multiCRMService = new MultiCRMService(campaign.user_id);
          await multiCRMService.initializeServices();

          for (const call of platformCalls) {
            // Create or update contact in CRM with campaign results
            const contactData = {
              first_name: call.contact_name.split(' ')[0],
              last_name: call.contact_name.split(' ').slice(1).join(' '),
              email: call.email,
              phone: call.phone_number,
              company: call.company,
              job_title: call.job_title,
              // Add campaign result fields
              campaign_outcome: call.outcome,
              campaign_notes: call.notes,
              last_campaign_date: call.created_at
            };

            try {
              await multiCRMService.createContactInPlatform(platform, contactData);
              syncResults[platform] = (syncResults[platform] || 0) + 1;
            } catch (error) {
              this.logger.error(`Failed to sync contact ${call.id} to ${platform}:`, error);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to sync to ${platform}:`, error);
          syncResults[platform] = { error: error.message };
        }
      }

      const totalSynced = Object.values(syncResults).reduce((sum, result) => 
        typeof result === 'number' ? sum + result : sum, 0
      );

      this.logger.info(`Campaign results synced to CRM: ${totalSynced} contacts`);

      return {
        success: true,
        syncedCount: totalSynced,
        results: syncResults
      };

    } catch (error) {
      this.logger.error('Error syncing campaign results to CRM:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get CRM contacts for campaign selection
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Contacts data
   */
  async getCRMContactsForCampaign(userId, filters = {}) {
    try {
      const { platform, search, limit = 100, offset = 0 } = filters;

      let query = supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('last_synced_at', { ascending: false });

      if (platform) {
        query = query.eq('crm_platform', platform);
      }

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
      }

      const { data, error } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch CRM contacts: ${error.message}`);
      }

      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('crm_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        this.logger.warn('Failed to get contacts count:', countError);
      }

      return {
        success: true,
        contacts: data || [],
        total: count || 0,
        limit,
        offset
      };

    } catch (error) {
      this.logger.error('Error fetching CRM contacts for campaign:', error);
      return {
        success: false,
        error: error.message,
        contacts: [],
        total: 0
      };
    }
  }

  /**
   * Create campaign from CRM contact list with filters
   * @param {string} userId - User ID
   * @param {Object} campaignData - Campaign configuration
   * @param {Object} contactFilters - Contact filter options
   * @returns {Promise<Object>} Campaign creation result
   */
  async createCampaignFromCRMFilter(userId, campaignData, contactFilters) {
    try {
      this.logger.info(`Creating campaign from CRM filter for user ${userId}`);

      // Get contacts based on filters
      const contactsResult = await this.getCRMContactsForCampaign(userId, contactFilters);
      
      if (!contactsResult.success) {
        throw new Error(contactsResult.error);
      }

      if (!contactsResult.contacts || contactsResult.contacts.length === 0) {
        throw new Error('No contacts found matching the specified filters');
      }

      // Create campaign with all filtered contacts
      const selectedContactIds = contactsResult.contacts.map(contact => contact.id);
      return await this.createCampaignFromCRMContacts(userId, campaignData, selectedContactIds);

    } catch (error) {
      this.logger.error('Error creating campaign from CRM filter:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get campaign statistics by CRM platform
   * @param {string} userId - User ID
   * @param {string} campaignId - Campaign ID (optional)
   * @returns {Promise<Object>} Statistics data
   */
  async getCRMStatistics(userId, campaignId = null) {
    try {
      let query = supabase
        .from('campaign_calls')
        .select('crm_platform, outcome, status')
        .eq('user_id', userId);

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch campaign statistics: ${error.message}`);
      }

      // Group statistics by platform
      const stats = data.reduce((acc, call) => {
        const platform = call.crm_platform || 'unknown';
        if (!acc[platform]) {
          acc[platform] = {
            total: 0,
            completed: 0,
            pending: 0,
            failed: 0,
            outcomes: {}
          };
        }

        acc[platform].total++;
        acc[platform][call.status] = (acc[platform][call.status] || 0) + 1;
        
        if (call.outcome) {
          acc[platform].outcomes[call.outcome] = (acc[platform].outcomes[call.outcome] || 0) + 1;
        }

        return acc;
      }, {});

      return {
        success: true,
        statistics: stats
      };

    } catch (error) {
      this.logger.error('Error fetching CRM statistics:', error);
      return {
        success: false,
        error: error.message,
        statistics: {}
      };
    }
  }
}

export { CRMCampaignService };


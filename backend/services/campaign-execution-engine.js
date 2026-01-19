// services/campaign-execution-engine.js
import { createClient } from '@supabase/supabase-js';
import { livekitOutboundService } from './livekit-outbound-service.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class CampaignExecutionEngine {
  constructor() {
    this.isRunning = false;
    this.executionInterval = null;
    this.checkInterval = 30000; // Check every 30 seconds
  }

  /**
   * Start the campaign execution engine
   */
  start() {
    if (this.isRunning) {
      console.log('Campaign execution engine is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting campaign execution engine...');

    // Check for campaigns to execute immediately
    this.executeCampaigns();

    // Set up interval for regular checks
    this.executionInterval = setInterval(() => {
      this.executeCampaigns();
    }, this.checkInterval);
  }

  /**
   * Stop the campaign execution engine
   */
  stop() {
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    this.isRunning = false;
    console.log('Campaign execution engine stopped');
  }

  /**
   * Execute campaigns that are ready to run
   */
  async executeCampaigns() {
    try {
      console.log('🔄 Campaign execution engine checking for campaigns...');

      // Reset daily caps at midnight
      await this.resetDailyCapsIfNeeded();

      // Get active campaigns that are ready to execute
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('execution_status', 'running')
        .lte('next_call_at', new Date().toISOString())
        .order('next_call_at', { ascending: true });

      if (error) {
        console.error('Error fetching campaigns:', error);
        return;
      }

      if (!campaigns || campaigns.length === 0) {
        console.log('No campaigns ready to execute');
        return;
      }

      console.log(`Found ${campaigns.length} campaigns ready to execute`);

      for (const campaign of campaigns) {
        await this.executeCampaign(campaign);
      }

    } catch (error) {
      console.error('Error in executeCampaigns:', error);
    }
  }

  /**
   * Reset daily caps at midnight
   */
  async resetDailyCapsIfNeeded() {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Check if we've already reset today by looking for any running campaign that was reset today
      const { data: runningCampaigns, error: resetError } = await supabase
        .from('campaigns')
        .select('id, last_daily_reset')
        .eq('execution_status', 'running');

      if (resetError) {
        console.error('Error checking running campaigns:', resetError);
        return;
      }

      if (!runningCampaigns || runningCampaigns.length === 0) {
        return; // No running campaigns to reset
      }

      // Check if any running campaign needs reset (hasn't been reset today)
      const needsReset = runningCampaigns.some(campaign =>
        !campaign.last_daily_reset ||
        !campaign.last_daily_reset.startsWith(today)
      );

      if (needsReset) {
        console.log('🔄 Resetting daily caps for all running campaigns');

        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            current_daily_calls: 0,
            last_daily_reset: now.toISOString()
          })
          .eq('execution_status', 'running');

        if (updateError) {
          console.error('Error resetting daily caps:', updateError);
        } else {
          console.log('✅ Daily caps reset successfully');
        }
      }
    } catch (error) {
      console.error('Error in resetDailyCapsIfNeeded:', error);
    }
  }

  /**
   * Execute a single campaign
   */
  async executeCampaign(campaign) {
    try {
      console.log(`Executing campaign: ${campaign.name} (${campaign.id})`);

      // Check if campaign should be paused or stopped
      if (!this.shouldExecuteCampaign(campaign)) {
        await this.pauseCampaign(campaign.id, 'Daily cap reached or outside calling hours');
        return;
      }

      // Process all calls immediately and continuously
      await this.processAllCalls(campaign);

    } catch (error) {
      console.error(`Error executing campaign ${campaign.id}:`, error);
      await this.pauseCampaign(campaign.id, `Execution error: ${error.message}`);
    }
  }

  /**
   * Process all calls immediately and continuously
   */
  async processAllCalls(campaign) {
    console.log(`🔄 Starting continuous processing for campaign: ${campaign.name}`);

    // Get all contacts for this campaign
    const contacts = await this.getCampaignContacts(campaign);
    if (!contacts || contacts.length === 0) {
      console.log(`No contacts found for campaign: ${campaign.name}`);
      await this.completeCampaign(campaign.id);
      return;
    }

    console.log(`📞 Found ${contacts.length} contacts to process`);

    // Process each contact immediately
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Check if campaign should continue (daily cap, calling hours, etc.)
      // Get fresh campaign data to check current daily calls
      const { data: freshCampaign } = await supabase
        .from('campaigns')
        .select('current_daily_calls, daily_cap, start_hour, end_hour, calling_days')
        .eq('id', campaign.id)
        .single();

      if (!freshCampaign) {
        console.log(`Campaign ${campaign.name} not found, stopping`);
        return;
      }

      // Update the campaign object with fresh data
      campaign.current_daily_calls = freshCampaign.current_daily_calls;
      campaign.daily_cap = freshCampaign.daily_cap;
      campaign.start_hour = freshCampaign.start_hour;
      campaign.end_hour = freshCampaign.end_hour;
      campaign.calling_days = freshCampaign.calling_days;

      if (!this.shouldExecuteCampaign(campaign)) {
        console.log(`Campaign ${campaign.name} reached daily cap or outside calling hours, pausing`);
        await this.pauseCampaign(campaign.id, 'Daily cap reached or outside calling hours');
        return;
      }

      // Check if campaign is still running
      const { data: currentCampaign } = await supabase
        .from('campaigns')
        .select('execution_status')
        .eq('id', campaign.id)
        .single();

      if (!currentCampaign || currentCampaign.execution_status !== 'running') {
        console.log(`Campaign ${campaign.name} is no longer running, stopping`);
        return;
      }

      console.log(`📞 Processing contact ${i + 1}/${contacts.length}: ${contact.name || 'Unknown'} - ${contact.phone_number}`);

      try {
        // Execute the call immediately
        console.log(`🔄 Starting call ${i + 1}/${contacts.length} for ${contact.name} - ${contact.phone_number}`);

        await this.executeCallDirect(campaign, contact, i + 1);

        // Update campaign metrics in database
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({
            dials: campaign.dials + 1,
            current_daily_calls: campaign.current_daily_calls + 1,
            total_calls_made: campaign.total_calls_made + 1,
            last_execution_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        if (updateError) {
          console.error('Error updating campaign metrics:', updateError);
        }

        // Update campaign object for next iteration (after successful DB update)
        campaign.dials = campaign.dials + 1;
        campaign.current_daily_calls = campaign.current_daily_calls + 1;
        campaign.total_calls_made = campaign.total_calls_made + 1;

        console.log(`✅ Call ${i + 1} initiated for campaign: ${campaign.name}`);

        // Add a small delay between calls (optional)
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

      } catch (callError) {
        console.error(`❌ Call ${i + 1} failed for campaign ${campaign.name}:`, callError);

        // Mark call as failed but continue with next call
        await this.createFailedCallRecord(campaign, contact, callError.message);
        continue;
      }
    }

    // All calls completed
    console.log(`🎉 All calls completed for campaign: ${campaign.name}`);
    await this.completeCampaign(campaign.id);
  }

  /**
   * Get all contacts for a campaign
   */
  async getCampaignContacts(campaign) {
    let contacts = [];

    // Get contacts based on campaign source
    if (campaign.contact_source === 'contact_list' && campaign.contact_list_id) {
      const { data: contactList, error } = await supabase
        .from('contact_lists')
        .select(`
          contacts(*)
        `)
        .eq('id', campaign.contact_list_id)
        .single();

      if (contactList && contactList.contacts) {
        contacts = contactList.contacts;
      }
    } else if (campaign.contact_source === 'csv_file' && campaign.csv_file_id) {
      const { data: csvContacts, error } = await supabase
        .from('csv_contacts')
        .select('*')
        .eq('csv_file_id', campaign.csv_file_id)
        .eq('do_not_call', false);

      if (csvContacts) {
        contacts = csvContacts;
      }
    }

    // Format contacts consistently
    return contacts.map(contact => {
      let phoneNumber = contact.phone_number || contact.phone;
      const contactName = contact.name || contact.first_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';

      // Fix phone number formatting
      if (phoneNumber && typeof phoneNumber === 'number') {
        phoneNumber = phoneNumber.toString();
      }

      // Ensure phone number has proper format
      if (phoneNumber && !phoneNumber.startsWith('+')) {
        if (phoneNumber.startsWith('44')) {
          phoneNumber = '+' + phoneNumber;
        } else if (phoneNumber.startsWith('0')) {
          phoneNumber = '+44' + phoneNumber.substring(1);
        } else if (phoneNumber.length === 10 && phoneNumber.startsWith('4')) {
          phoneNumber = '+44' + phoneNumber;
        }
      }

      return {
        id: contact.id,
        name: contactName,
        phone_number: phoneNumber,
        email: contact.email || contact.email_address || ''
      };
    }).filter(contact => contact.phone_number && contact.phone_number.length >= 10);
  }

  /**
   * Execute call directly using LiveKit
   */
  async executeCallDirect(campaign, contact, callNumber) {
    // Create campaign call record
    const { data: campaignCall, error: callError } = await supabase
      .from('campaign_calls')
      .insert({
        campaign_id: campaign.id,
        contact_id: campaign.contact_source === 'contact_list' ? contact.id : null,
        phone_number: contact.phone_number,
        contact_name: contact.name,
        status: 'calling',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (callError) {
      throw new Error(`Failed to create campaign call record: ${callError.message}`);
    }

    // Execute the call using LiveKit
    await this.executeCall(campaign, { campaign_calls: campaignCall });
  }

  /**
   * Execute a single call using LiveKit SIP participant
   */
  async executeCall(campaign, queueItem) {
    try {
      const campaignCall = queueItem.campaign_calls;

      // 1) Mark processing
      await supabase.from('campaign_calls').update({ status: 'calling', started_at: new Date().toISOString() })
        .eq('id', campaignCall.id);

      // 2) Resolve outbound trunk + caller id
      let outboundTrunkId = null, fromNumber = null;
      if (campaign.assistant_id) {
        const { data: assistantPhone, error: phoneError } = await supabase
          .from('phone_number')
          .select('outbound_trunk_id, number')
          .eq('inbound_assistant_id', campaign.assistant_id)
          .eq('status', 'active')
          .single();

        if (phoneError) {
          if (phoneError.code === 'PGRST116') {
            throw new Error(`Phone Number Missing: No phone number assigned to assistant ${campaign.assistant_id}. Please go to the Assistants page and assign a phone number to this assistant.`);
          } else {
            throw new Error(`Error fetching phone number for assistant: ${phoneError.message}`);
          }
        }

        if (assistantPhone) {
          outboundTrunkId = assistantPhone.outbound_trunk_id;
          fromNumber = assistantPhone.number;
        }
      }

      if (!outboundTrunkId) {
        throw new Error(`Outbound Configuration Missing: No outbound trunk configured for assistant ${campaign.assistant_id}. Please ensure the assistant has a phone number assigned with a valid outbound trunk. You may need to recreate the phone number in Settings.`);
      }

      // 3) Build room & metadata
      const baseUrl = process.env.NGROK_URL || process.env.BACKEND_URL || '';
      const callId = `campaign-${campaign.id}-${campaignCall.id}-${Date.now()}`;
      const toNumber = campaignCall.phone_number.startsWith('+')
        ? campaignCall.phone_number
        : `+${campaignCall.phone_number}`;
      const roomName = `call-${toNumber}-${Date.now()}`;

      const campaignMetadata = {
        assistantId: campaign.assistant_id,
        campaignId: campaign.id,
        campaignPrompt: campaign.campaign_prompt || '',
        contactInfo: {
          name: campaignCall.contact_name || 'Unknown',
          email: campaignCall.email || '',
          phone: campaignCall.phone_number,
        },
        source: 'outbound',
        callType: 'campaign',
      };

      // Persist metadata for webhook access (non-blocking)
      if (baseUrl) {
        try {
          const metadataUrl = `${baseUrl}/api/v1/campaigns/metadata/${roomName}`;
          await fetch(metadataUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(campaignMetadata) });
        } catch (e) {
          console.log('⚠️ metadata post failed:', e?.message);
        }
      }

      // 4) LiveKit HTTP base for server SDKs
      const LK_HTTP_URL = process.env.LIVEKIT_HOST;
      if (!LK_HTTP_URL.startsWith('http')) {
        throw new Error(`LIVEKIT_URL/HOST must be https/http for server SDKs. Got: ${process.env.LIVEKIT_HOST}`);
      }

      const { SipClient, RoomServiceClient, AccessToken, AgentDispatchClient } = await import('livekit-server-sdk');
      const roomClient = new RoomServiceClient(LK_HTTP_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      const sipClient = new SipClient(LK_HTTP_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
      const agentDispatchClient = new AgentDispatchClient(LK_HTTP_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

      // 5) Ensure room exists
      try {
        console.log('🏠 Creating/verifying room', roomName);
        await roomClient.createRoom({
          name: roomName,
          metadata: JSON.stringify({
            ...campaignMetadata,
            createdAt: new Date().toISOString(),
          }),
        });
        console.log('✅ Room ok:', roomName);
      } catch (e) {
        console.log('⚠️ Room create warning (may exist):', e?.message);
      }

      // 6) DISPATCH AGENT FIRST
      const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
        identity: `agent-dispatcher-${Date.now()}`,
        metadata: JSON.stringify({ campaignId: campaign.id }),
      });
      at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
      const jwt = await at.toJwt();

      // Try different dispatch URL formats
      const dispatchUrl = `${LK_HTTP_URL}/twirp/livekit.AgentService/CreateAgentDispatch`;
      const alternativeUrl = `${LK_HTTP_URL}/twirp/livekit.AgentService/CreateAgentDispatchRequest`;

      console.log('🔍 Dispatch URL check:', {
        LK_HTTP_URL,
        dispatchUrl,
        alternativeUrl,
        expectedFormat: 'https://your-livekit-host/twirp/livekit.AgentService/CreateAgentDispatch'
      });
      const agentName = process.env.LK_AGENT_NAME || 'ai';
      console.log('🔍 Agent name check:', {
        LK_AGENT_NAME: process.env.LK_AGENT_NAME,
        agentName,
        fallback: 'ai'
      });

      // Try different dispatch body formats
      const dispatchBody = {
        agent_name: agentName,
        room: roomName,
        metadata: JSON.stringify({
          phone_number: toNumber,  // Add phone number for outbound calling
          agentId: campaign.assistant_id,
          callType: 'campaign',
          campaignId: campaign.id,
          contactName: campaignCall.contact_name || 'Unknown',
          campaignPrompt: campaign.campaign_prompt || '',  // Add campaign prompt
          outbound_trunk_id: outboundTrunkId,  // Add outbound trunk ID
        }),
      };

      // Alternative format that might work
      const alternativeBody = {
        agentName: agentName,
        roomName: roomName,
        metadata: JSON.stringify({
          phone_number: toNumber,
          agentId: campaign.assistant_id,
          callType: 'campaign',
          campaignId: campaign.id,
          contactName: campaignCall.contact_name || 'Unknown',
          campaignPrompt: campaign.campaign_prompt || '',  // Add campaign prompt
          outbound_trunk_id: outboundTrunkId,  // Add outbound trunk ID
        }),
      };

      console.log('🔍 Dispatch body formats:', {
        primary: dispatchBody,
        alternative: alternativeBody
      });

      // Use the correct AgentDispatchClient method
      try {
        console.log('🤖 Dispatching agent via AgentDispatchClient:', {
          agent_name: agentName,
          room: roomName,
          metadata: dispatchBody.metadata
        });

        const dispatchResult = await agentDispatchClient.createDispatch(roomName, agentName, {
          metadata: dispatchBody.metadata,
        });

        console.log('✅ Agent dispatch successful via AgentDispatchClient:', dispatchResult);
      } catch (sdkError) {
        console.log('⚠️ AgentDispatchClient failed, trying HTTP method:', sdkError.message);

        // Fallback to HTTP method
        console.log('🤖 Dispatching agent via HTTP:', {
          url: dispatchUrl,
          agent_name: dispatchBody.agent_name,
          room: roomName,
          jwt_len: jwt.length,
          dispatchBody: dispatchBody,
        });

        const dispatchRes = await fetch(dispatchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify(dispatchBody),
        });
        const dispatchTxt = await dispatchRes.text();
        console.log(`🤖 HTTP Dispatch response: ${dispatchRes.status} ${dispatchTxt}`);

        if (!dispatchRes.ok) {
          throw new Error(`Agent dispatch failed: ${dispatchRes.status} ${dispatchTxt}`);
        }
      }

      console.log('✅ Agent dispatched successfully - Python agent will handle outbound calling');

      // 7) Create SIP participant using the exact pattern from sass-livekit
      console.log(`Creating SIP participant using working pattern:`, {
        outboundTrunkId,
        phoneNumber: toNumber,
        roomName
      });

      // Create metadata exactly like sass-livekit
      const metadata = {
        agentId: campaign.assistant_id,
        callType: "telephone",
        callId: callId,
        dir: "outbound",
        customer_name: campaignCall.contact_name || 'Unknown',
        context: campaign.campaign_prompt || '',
        phone_number: fromNumber,
        isWebCall: false,
        to_phone_number: toNumber,
        isGoogleSheet: false,
        campaignId: campaign.id,
        source: 'campaign'
      };

      // Use the exact same sipParticipantOptions structure
      const sipParticipantOptions = {
        participantIdentity: `identity-${Date.now()}`,
        participantName: JSON.stringify(metadata),
        krispEnabled: true
      };

      console.log("🔍 SIP Participant Creation Details:", {
        outboundTrunkId,
        toNumber: campaignCall.phone_number,
        roomName,
        sipParticipantOptions,
        metadata
      });

      try {
        const participant = await sipClient.createSipParticipant(
          outboundTrunkId,
          toNumber,
          roomName,
          sipParticipantOptions
        );

        console.log("✅ SIP Participant Created Successfully:", participant);

        // Additional debugging for SIP call status
        console.log("🔍 SIP Call Details:", {
          sipCallId: participant.sipCallId,
          participantId: participant.participantId,
          roomName: participant.roomName,
          participantIdentity: participant.participantIdentity
        });

      } catch (sipError) {
        console.error("❌ SIP Participant Creation Failed:", sipError);
        throw new Error(`Failed to create SIP participant: ${sipError.message}`);
      }

      // 8) Update campaign call with participant info and room name
      await supabase
        .from('campaign_calls')
        .update({
          call_sid: callId, // Store call ID as call_sid for compatibility
          room_name: roomName
        })
        .eq('id', campaignCall.id);

      console.log(`🎉 LiveKit SIP call initiated for campaign ${campaign.name}: ${campaignCall.phone_number}`);

    } catch (error) {
      console.error(`Error executing call for campaign ${campaign.id}:`, error);

      // Mark call as failed
      await supabase
        .from('campaign_calls')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          notes: error.message
        })
        .eq('id', queueItem.campaign_calls.id);

      throw error;
    }
  }

  /**
   * Create failed call record
   */
  async createFailedCallRecord(campaign, contact, errorMessage) {
    await supabase
      .from('campaign_calls')
      .insert({
        campaign_id: campaign.id,
        contact_id: campaign.contact_source === 'contact_list' ? contact.id : null,
        phone_number: contact.phone_number,
        contact_name: contact.name,
        status: 'failed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        notes: errorMessage
      });
  }

  /**
   * Check if campaign should continue executing
   */
  shouldExecuteCampaign(campaign) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    console.log(`🔍 Debugging campaign ${campaign.name}:`);
    console.log(`  Current time: ${now.toISOString()}`);
    console.log(`  Current hour: ${currentHour}`);
    console.log(`  Current day: ${currentDay}`);
    console.log(`  Campaign start hour: ${campaign.start_hour}`);
    console.log(`  Campaign end hour: ${campaign.end_hour}`);
    console.log(`  Campaign calling days: ${JSON.stringify(campaign.calling_days)}`);
    console.log(`  Current daily calls: ${campaign.current_daily_calls}`);
    console.log(`  Daily cap: ${campaign.daily_cap}`);

    // Check if we're within calling hours
    let withinHours = false;

    // Special case: if both start and end are 0, it means 24/7 (all day)
    if (campaign.start_hour === 0 && campaign.end_hour === 0) {
      withinHours = true;
      console.log(`  ✅ 24/7 calling hours enabled`);
    } else if (campaign.end_hour === 24) {
      // End hour is 24 (midnight/end of day) - call until end of day
      withinHours = currentHour >= campaign.start_hour;
      console.log(`  ✅ Calling until end of day (${campaign.start_hour}-24)`);
    } else if (campaign.start_hour <= campaign.end_hour) {
      // Normal case: start and end on same day (e.g., 9 AM to 5 PM)
      withinHours = currentHour >= campaign.start_hour && currentHour < campaign.end_hour;
    } else {
      // Cross-midnight case: start before midnight, end after midnight (e.g., 10 PM to 2 AM)
      withinHours = currentHour >= campaign.start_hour || currentHour < campaign.end_hour;
    }

    if (!withinHours) {
      console.log(`  ❌ Outside calling hours: ${currentHour} not between ${campaign.start_hour}-${campaign.end_hour}`);
      return false;
    }

    // Check if today is a calling day
    if (!campaign.calling_days.includes(currentDay)) {
      console.log(`  ❌ Not a calling day: ${currentDay} not in ${JSON.stringify(campaign.calling_days)}`);
      return false;
    }

    // Check daily cap
    if (campaign.current_daily_calls >= campaign.daily_cap) {
      console.log(`  ❌ Daily cap reached: ${campaign.current_daily_calls}/${campaign.daily_cap}`);
      return false;
    }

    console.log(`  ✅ Campaign should execute!`);
    return true;
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId, reason) {
    await supabase
      .from('campaigns')
      .update({
        execution_status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log(`Campaign ${campaignId} paused: ${reason}`);
  }

  /**
   * Complete campaign
   */
  async completeCampaign(campaignId) {
    await supabase
      .from('campaigns')
      .update({
        execution_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log(`Campaign ${campaignId} completed`);
  }

  /**
   * Start campaign
   */
  async startCampaign(campaignId) {
    try {
      // Get campaign details
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error || !campaign) {
        throw new Error('Campaign not found');
      }

      // Update campaign status to running
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          execution_status: 'running',
          next_call_at: new Date().toISOString(),
          current_daily_calls: 0
        })
        .eq('id', campaignId);

      if (updateError) {
        console.error('Error updating campaign status:', updateError);
        throw updateError;
      }

      console.log(`✅ Campaign ${campaignId} started with status: running, next_call_at: ${new Date().toISOString()}`);

    } catch (error) {
      console.error(`Error starting campaign ${campaignId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const campaignEngine = new CampaignExecutionEngine();
export { CampaignExecutionEngine };

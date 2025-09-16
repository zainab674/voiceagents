// services/outbound-calls-service.js
import Twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class OutboundCallsService {
  constructor() {
    this.twilio = null;
    this.initializeTwilio();
  }

  initializeTwilio() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken) {
      this.twilio = Twilio(accountSid, authToken);
    }
  }

  /**
   * Initiate outbound call for campaign
   */
  async initiateOutboundCall({
    campaignId,
    phoneNumber,
    contactName,
    assistantId,
    fromNumber
  }) {
    try {
      console.log('Initiating outbound call:', {
        campaignId,
        phoneNumber,
        contactName,
        assistantId,
        fromNumber
      });

      // Get campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        throw new Error('Campaign not found');
      }

      // Get assistant details
      const { data: assistant, error: assistantError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', assistantId)
        .single();

      if (assistantError || !assistant) {
        throw new Error('Assistant not found');
      }

      // Generate unique room name
      const roomName = `outbound-${campaignId}-${Date.now()}`;

      // Create campaign call record
      const { data: campaignCall, error: callError } = await supabase
        .from('campaign_calls')
        .insert({
          campaign_id: campaignId,
          phone_number: phoneNumber,
          contact_name: contactName,
          room_name: roomName,
          status: 'calling',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (callError) {
        console.error('Error creating campaign call:', callError);
        throw new Error('Failed to create campaign call record');
      }

      // Get the phone number to call from
      let fromPhoneNumber = fromNumber;
      
      if (!fromPhoneNumber) {
        // Try to get phone number from assistant
        if (assistantId) {
          const { data: assistantPhone, error: phoneError } = await supabase
            .from('phone_number')
            .select('number')
            .eq('inbound_assistant_id', assistantId)
            .eq('status', 'active')
            .single();
          
          if (!phoneError && assistantPhone) {
            fromPhoneNumber = assistantPhone.number;
          }
        }
        
        // Fallback to environment variable if no assistant phone found
        if (!fromPhoneNumber) {
          fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        }
      }
      
      if (!fromPhoneNumber) {
        throw new Error('No phone number configured for outbound calls. Please assign a phone number to the assistant or set TWILIO_PHONE_NUMBER in your environment variables.');
      }

      // Create LiveKit room URL for the call
      const baseUrl = process.env.BACKEND_URL || process.env.NGROK_URL || 'http://localhost:4000';
      const livekitRoomUrl = `${baseUrl}/api/v1/livekit/room/${roomName}`;

      // Initiate Twilio call
      const call = await this.twilio.calls.create({
        to: phoneNumber,
        from: fromPhoneNumber,
        url: livekitRoomUrl,
        method: 'POST',
        statusCallback: `${baseUrl}/api/v1/outbound-calls/status-callback`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true,
        recordingChannels: 'dual',
        recordingTrack: 'both',
        recordingStatusCallback: `${baseUrl}/api/v1/recording/status`,
        recordingStatusCallbackMethod: 'POST'
      });

      // Update campaign call with Twilio call SID
      await supabase
        .from('campaign_calls')
        .update({
          call_sid: call.sid,
          started_at: new Date().toISOString()
        })
        .eq('id', campaignCall.id);

      // Update campaign metrics
      await supabase
        .from('campaigns')
        .update({
          dials: campaign.dials + 1,
          current_daily_calls: campaign.current_daily_calls + 1,
          total_calls_made: campaign.total_calls_made + 1,
          last_execution_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      return {
        success: true,
        callSid: call.sid,
        roomName: roomName,
        campaignCallId: campaignCall.id,
        status: call.status
      };

    } catch (error) {
      console.error('Error initiating outbound call:', error);
      throw error;
    }
  }

  /**
   * Handle Twilio call status callback
   */
  async handleStatusCallback({
    CallSid,
    CallStatus,
    CallDuration,
    To,
    From,
    Direction
  }) {
    try {
      console.log('Outbound call status callback:', {
        CallSid,
        CallStatus,
        CallDuration,
        To,
        From
      });

      // Find the campaign call by call SID
      const { data: campaignCall, error: callError } = await supabase
        .from('campaign_calls')
        .select('*, campaigns(*)')
        .eq('call_sid', CallSid)
        .single();

      if (callError || !campaignCall) {
        console.error('Campaign call not found for SID:', CallSid);
        return { success: false, message: 'Campaign call not found' };
      }

      const campaign = campaignCall.campaigns;
      let newStatus = campaignCall.status;
      let outcome = campaignCall.outcome;

      // Update status based on Twilio call status
      switch (CallStatus) {
        case 'ringing':
          newStatus = 'calling';
          break;
        case 'in-progress':
          newStatus = 'answered';
          break;
        case 'completed':
          newStatus = 'completed';
          // Determine outcome based on duration and other factors
          if (CallDuration && parseInt(CallDuration) < 10) {
            outcome = 'no_answer';
          } else if (CallDuration && parseInt(CallDuration) > 10) {
            outcome = 'answered';
          }
          break;
        case 'busy':
          newStatus = 'failed';
          outcome = 'busy';
          break;
        case 'no-answer':
          newStatus = 'failed';
          outcome = 'no_answer';
          break;
        case 'failed':
          newStatus = 'failed';
          break;
      }

      // Update campaign call
      const updateData = {
        status: newStatus,
        call_duration: CallDuration ? parseInt(CallDuration) : 0,
        completed_at: CallStatus === 'completed' ? new Date().toISOString() : null
      };

      if (outcome) {
        updateData.outcome = outcome;
      }

      await supabase
        .from('campaign_calls')
        .update(updateData)
        .eq('id', campaignCall.id);

      // Update campaign metrics
      if (newStatus === 'answered') {
        await supabase
          .from('campaigns')
          .update({
            pickups: campaign.pickups + 1,
            total_calls_answered: campaign.total_calls_answered + 1
          })
          .eq('id', campaign.id);
      }

      // Update outcome-specific metrics
      if (outcome) {
        const outcomeUpdates = {};
        switch (outcome) {
          case 'interested':
            outcomeUpdates.interested = campaign.interested + 1;
            break;
          case 'not_interested':
            outcomeUpdates.not_interested = campaign.not_interested + 1;
            break;
          case 'callback':
            outcomeUpdates.callback = campaign.callback + 1;
            break;
          case 'do_not_call':
            outcomeUpdates.do_not_call = campaign.do_not_call + 1;
            break;
        }

        if (Object.keys(outcomeUpdates).length > 0) {
          await supabase
            .from('campaigns')
            .update(outcomeUpdates)
            .eq('id', campaign.id);
        }
      }

      return { success: true };

    } catch (error) {
      console.error('Error processing call status callback:', error);
      throw error;
    }
  }

  /**
   * Get campaign call details
   */
  async getCampaignCalls(campaignId, options = {}) {
    try {
      const { status, limit = 50, offset = 0 } = options;

      let query = supabase
        .from('campaign_calls')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: calls, error } = await query;

      if (error) {
        throw error;
      }

      return {
        success: true,
        calls: calls || []
      };

    } catch (error) {
      console.error('Error fetching campaign calls:', error);
      throw error;
    }
  }

  /**
   * Update call outcome
   */
  async updateCallOutcome(callId, outcome, notes) {
    try {
      if (!outcome) {
        throw new Error('Outcome is required');
      }

      const { data: call, error: callError } = await supabase
        .from('campaign_calls')
        .select('*, campaigns(*)')
        .eq('id', callId)
        .single();

      if (callError || !call) {
        throw new Error('Campaign call not found');
      }

      // Update call outcome
      const { error: updateError } = await supabase
        .from('campaign_calls')
        .update({
          outcome,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (updateError) {
        throw updateError;
      }

      // Update campaign metrics
      const campaign = call.campaigns;
      const outcomeUpdates = {};
      
      // Remove old outcome count
      switch (call.outcome) {
        case 'interested':
          outcomeUpdates.interested = Math.max(0, campaign.interested - 1);
          break;
        case 'not_interested':
          outcomeUpdates.not_interested = Math.max(0, campaign.not_interested - 1);
          break;
        case 'callback':
          outcomeUpdates.callback = Math.max(0, campaign.callback - 1);
          break;
        case 'do_not_call':
          outcomeUpdates.do_not_call = Math.max(0, campaign.do_not_call - 1);
          break;
      }

      // Add new outcome count
      switch (outcome) {
        case 'interested':
          outcomeUpdates.interested = (outcomeUpdates.interested || campaign.interested) + 1;
          break;
        case 'not_interested':
          outcomeUpdates.not_interested = (outcomeUpdates.not_interested || campaign.not_interested) + 1;
          break;
        case 'callback':
          outcomeUpdates.callback = (outcomeUpdates.callback || campaign.callback) + 1;
          break;
        case 'do_not_call':
          outcomeUpdates.do_not_call = (outcomeUpdates.do_not_call || campaign.do_not_call) + 1;
          break;
      }

      if (Object.keys(outcomeUpdates).length > 0) {
        await supabase
          .from('campaigns')
          .update(outcomeUpdates)
          .eq('id', campaign.id);
      }

      return {
        success: true,
        message: 'Call outcome updated successfully'
      };

    } catch (error) {
      console.error('Error updating call outcome:', error);
      throw error;
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId) {
    try {
      const { data: calls, error } = await supabase
        .from('campaign_calls')
        .select('status, outcome, call_duration')
        .eq('campaign_id', campaignId);

      if (error) {
        throw error;
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

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      throw error;
    }
  }
}

export const outboundCallsService = new OutboundCallsService();
export { OutboundCallsService };

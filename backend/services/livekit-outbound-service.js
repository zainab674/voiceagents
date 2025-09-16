// services/livekit-outbound-service.js
import { SipClient, RoomServiceClient, AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class LiveKitOutboundService {
  constructor() {
    this.livekitHost = process.env.LIVEKIT_HOST;
    this.livekitApiKey = process.env.LIVEKIT_API_KEY;
    this.livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!this.livekitHost || !this.livekitApiKey || !this.livekitApiSecret) {
      throw new Error('Missing LiveKit configuration');
    }

    // Ensure LiveKit host uses HTTP/HTTPS for server SDKs
    const httpUrl = this.livekitHost.startsWith('wss://') 
      ? this.livekitHost.replace('wss://', 'https://')
      : this.livekitHost.startsWith('ws://')
      ? this.livekitHost.replace('ws://', 'http://')
      : this.livekitHost;

    this.sipClient = new SipClient(httpUrl, this.livekitApiKey, this.livekitApiSecret);
    this.roomClient = new RoomServiceClient(httpUrl, this.livekitApiKey, this.livekitApiSecret);
    this.agentDispatchClient = new AgentDispatchClient(httpUrl, this.livekitApiKey, this.livekitApiSecret);
  }

  /**
   * Create a SIP participant for outbound calling
   */
  async createSipParticipant({
    outboundTrunkId,
    phoneNumber,
    roomName,
    participantIdentity,
    participantName,
    assistantId,
    campaignId,
    contactName,
    waitUntilAnswered = true,
    playDialtone = false,
    krispEnabled = true
  }) {
    try {
      console.log(`Creating SIP participant for outbound call:`, {
        outboundTrunkId,
        phoneNumber,
        roomName,
        participantIdentity,
        assistantId,
        campaignId
      });

      if (!outboundTrunkId || !phoneNumber || !roomName) {
        throw new Error('outboundTrunkId, phoneNumber, and roomName are required');
      }

      // Create SIP participant options
      const sipParticipantOptions = {
        participantIdentity: participantIdentity || `identity-${Date.now()}`,
        participantName: participantName || 'AI Assistant',
        krispEnabled: krispEnabled !== false,
        waitUntilAnswered,
        playDialtone,
        metadata: JSON.stringify({
          assistantId,
          campaignId,
          contactName,
          callType: 'outbound',
          source: 'campaign'
        })
      };

      const participant = await this.sipClient.createSipParticipant(
        outboundTrunkId,
        phoneNumber,
        roomName,
        sipParticipantOptions
      );

      console.log(`SIP participant created successfully:`, {
        participantId: participant.participantIdentity,
        roomName: participant.roomName,
        status: participant.status
      });

      return {
        success: true,
        participant: {
          participantId: participant.participantIdentity,
          roomName: participant.roomName,
          status: participant.status,
          sipCallTo: participant.sipCallTo,
          sipNumber: participant.sipNumber
        }
      };

    } catch (error) {
      console.error('Error creating SIP participant:', error);
      throw error;
    }
  }

  /**
   * Get outbound trunk for an assistant
   */
  async getOutboundTrunkForAssistant(assistantId) {
    try {
      // Get phone number assigned to this assistant
      const { data: phoneNumber, error: phoneError } = await supabase
        .from('phone_number')
        .select('outbound_trunk_id, outbound_trunk_name, number')
        .eq('inbound_assistant_id', assistantId)
        .eq('status', 'active')
        .single();

      if (phoneError || !phoneNumber) {
        throw new Error('No outbound trunk found for this assistant');
      }

      return {
        success: true,
        trunk: {
          outboundTrunkId: phoneNumber.outbound_trunk_id,
          outboundTrunkName: phoneNumber.outbound_trunk_name,
          phoneNumber: phoneNumber.number
        }
      };

    } catch (error) {
      console.error('Error getting outbound trunk:', error);
      throw error;
    }
  }

  /**
   * List all outbound trunks
   */
  async listOutboundTrunks() {
    try {
      const trunks = await this.sipClient.listSipOutboundTrunk();
      
      return {
        success: true,
        trunks: trunks.map(trunk => ({
          trunkId: trunk.sipTrunkId || trunk.sip_trunk_id,
          name: trunk.name,
          address: trunk.address,
          numbers: trunk.numbers,
          metadata: trunk.metadata
        }))
      };

    } catch (error) {
      console.error('Error listing outbound trunks:', error);
      throw error;
    }
  }

  /**
   * Create outbound trunk for assistant
   */
  async createOutboundTrunkForAssistant(assistantId, phoneNumber, userId) {
    try {
      console.log(`🚀 Creating outbound trunk for assistant: ${assistantId}, phone: ${phoneNumber}, user: ${userId}`);
      
      // Get assistant details
      const { data: assistant, error: assistantError } = await supabase
        .from('agents')
        .select('name, user_id')
        .eq('id', assistantId)
        .single();

      if (assistantError || !assistant) {
        console.error('❌ Assistant not found:', assistantError);
        throw new Error('Assistant not found');
      }

      console.log(`✅ Found assistant: ${assistant.name}`);

      // Use the provided userId or fall back to assistant's user_id
      const targetUserId = userId || assistant.user_id;
      if (!targetUserId) {
        throw new Error('User ID is required for outbound trunk creation');
      }

      const trunkName = `outbound-${assistantId}-${Date.now()}`;
      const outboundTrunkName = `Outbound Trunk for ${assistant.name}`;

      // Get dynamic Twilio SIP configuration from database
      console.log(`🔍 Getting SIP config for user ${targetUserId} to create outbound trunk`);
      const { getSipConfigForLiveKit } = await import('./twilio-trunk-service.js');
      
      let sipConfig;
      try {
        sipConfig = await getSipConfigForLiveKit(targetUserId);
        console.log(`📊 Retrieved SIP config successfully:`, {
          domainName: sipConfig.domainName,
          sipUsername: sipConfig.sipUsername,
          hasPassword: !!sipConfig.sipPassword,
          trunkSid: sipConfig.trunkSid,
          credentialListSid: sipConfig.credentialListSid
        });
      } catch (sipError) {
        console.error('❌ Failed to get SIP config:', sipError);
        throw new Error(`Failed to get SIP configuration for user: ${sipError.message}`);
      }

      const destinationCountry = process.env.SIP_DESTINATION_COUNTRY || 'US';

      // Debug Twilio credentials
      console.log('🔍 Dynamic Twilio SIP Configuration:', {
        domainName: sipConfig.domainName,
        destinationCountry,
        sipUsername: sipConfig.sipUsername ? `${sipConfig.sipUsername.substring(0, 8)}...` : 'MISSING',
        sipPassword: sipConfig.sipPassword ? `${sipConfig.sipPassword.substring(0, 8)}...` : 'MISSING'
      });

      // Create outbound trunk using dynamic configuration
      const trunkOptions = {
        auth_username: sipConfig.sipUsername,
        auth_password: sipConfig.sipPassword,
        destination_country: destinationCountry,
        metadata: JSON.stringify({
          kind: 'per-assistant-outbound-trunk',
          assistantId,
          assistantName: assistant.name,
          phoneNumber: phoneNumber,
          domainName: sipConfig.domainName,
          trunkSid: sipConfig.trunkSid,
          userId: targetUserId,
          createdAt: new Date().toISOString(),
        }),
      };

      console.log(`🚀 Creating LiveKit outbound trunk with:`, {
        outboundTrunkName,
        domainName: sipConfig.domainName,
        phoneNumber: phoneNumber,
        trunkOptions
      });

      // Create outbound trunk
      const outboundTrunk = await this.sipClient.createSipOutboundTrunk(
        outboundTrunkName,
        sipConfig.domainName,  // Dynamic domain name from Twilio
        [phoneNumber], // Phone numbers
        trunkOptions
      );

      console.log(`✅ Outbound trunk created successfully:`, {
        trunkId: outboundTrunk.sipTrunkId,
        name: outboundTrunk.name,
        assistantId,
        phoneNumber,
        domainName: sipConfig.domainName
      });

      // Save outbound trunk to database
      try {
        const { upsertPhoneNumber } = await import('./phoneNumberService.js');
        const phoneNumberData = {
          phone_sid: null, // No Twilio SID for outbound-only trunks
          number: phoneNumber,
          label: `Outbound trunk for ${assistant.name}`,
          inbound_assistant_id: assistantId,
          inbound_trunk_id: null, // No inbound trunk for outbound-only
          outbound_trunk_id: outboundTrunk.sipTrunkId,
          outbound_trunk_name: outboundTrunk.name,
          webhook_status: 'configured',
          status: 'active',
        };

        const phoneResult = await upsertPhoneNumber(phoneNumberData, targetUserId);
        if (!phoneResult.success) {
          console.warn('⚠️ Failed to save outbound trunk to database:', phoneResult.message);
          // Continue execution - the trunk will still work via LiveKit
        } else {
          console.log('✅ Outbound trunk saved to database successfully');
        }
      } catch (dbError) {
        console.error('❌ Error saving outbound trunk to database:', dbError);
        // Continue execution - the trunk will still work via LiveKit
      }

      return {
        success: true,
        trunk: {
          outboundTrunkId: outboundTrunk.sipTrunkId,
          outboundTrunkName: outboundTrunk.name,
          phoneNumber: phoneNumber,
          domainName: sipConfig.domainName
        }
      };

    } catch (error) {
      console.error('❌ Error creating outbound trunk:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        assistantId,
        phoneNumber,
        userId
      });
      throw error;
    }
  }

  /**
   * Dispatch agent to room for outbound call
   */
  async dispatchAgentToRoom(roomName, assistantId, campaignId, contactInfo) {
    try {
      console.log(`Dispatching agent to room: ${roomName}`);

      // Create access token for agent dispatch
      const at = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
        identity: `agent-dispatcher-${Date.now()}`,
        metadata: JSON.stringify({
          campaignId,
          assistantId,
          callType: 'campaign',
          phoneNumber: contactInfo.phone,
          contactName: contactInfo.name
        })
      });

      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });

      const jwt = await at.toJwt();

      // Dispatch agent using AgentDispatchClient
      const agentName = process.env.LK_AGENT_NAME || 'ai';
      const dispatchResult = await this.agentDispatchClient.createDispatch(roomName, agentName, {
        metadata: JSON.stringify({
          phone_number: contactInfo.phone,
          agentId: assistantId,
          callType: 'campaign',
          campaignId: campaignId,
          contactName: contactInfo.name,
          outbound_trunk_id: contactInfo.outboundTrunkId,
        }),
      });

      console.log('✅ Agent dispatched successfully:', dispatchResult);
      return { success: true, result: dispatchResult };

    } catch (error) {
      console.error('Error dispatching agent:', error);
      throw error;
    }
  }

  /**
   * Ensure room exists for outbound call
   */
  async ensureRoomExists(roomName, metadata) {
    try {
      console.log('🏠 Creating/verifying room', roomName);
      
      await this.roomClient.createRoom({
        name: roomName,
        metadata: JSON.stringify({
          ...metadata,
          createdAt: new Date().toISOString(),
        }),
      });
      
      console.log('✅ Room created/verified:', roomName);
      return { success: true };

    } catch (error) {
      // Room might already exist, which is fine
      if (error.message && error.message.includes('already exists')) {
        console.log('⚠️ Room already exists:', roomName);
        return { success: true };
      }
      
      console.error('Error creating room:', error);
      throw error;
    }
  }

  /**
   * Create complete outbound call setup
   */
  async createOutboundCall({
    assistantId,
    campaignId,
    phoneNumber,
    contactName,
    campaignPrompt,
    userId
  }) {
    try {
      console.log(`🚀 Creating outbound call for assistant: ${assistantId}, phone: ${phoneNumber}, user: ${userId}`);
      
      // Get outbound trunk for assistant
      let outboundTrunkId;
      const trunkResult = await this.getOutboundTrunkForAssistant(assistantId);
      if (!trunkResult.success) {
        console.log('⚠️ No existing outbound trunk found, creating new one...');
        // Create outbound trunk if it doesn't exist
        const createTrunkResult = await this.createOutboundTrunkForAssistant(assistantId, phoneNumber, userId);
        if (!createTrunkResult.success) {
          throw new Error('Failed to create outbound trunk for assistant');
        }
        outboundTrunkId = createTrunkResult.trunk.outboundTrunkId;
      } else {
        outboundTrunkId = trunkResult.trunk.outboundTrunkId;
      }

      // Generate unique room name
      const roomName = `call-${phoneNumber}-${Date.now()}`;

      // Prepare metadata
      const metadata = {
        assistantId,
        campaignId,
        campaignPrompt: campaignPrompt || '',
        contactInfo: {
          name: contactName || 'Unknown',
          phone: phoneNumber,
        },
        source: 'outbound',
        callType: 'campaign',
      };

      // Ensure room exists
      await this.ensureRoomExists(roomName, metadata);

      // Create SIP participant
      const participantResult = await this.createSipParticipant({
        outboundTrunkId,
        phoneNumber,
        roomName,
        assistantId,
        campaignId,
        contactName
      });

      if (!participantResult.success) {
        throw new Error('Failed to create SIP participant');
      }

      // Dispatch agent to room
      await this.dispatchAgentToRoom(roomName, assistantId, campaignId, {
        phone: phoneNumber,
        name: contactName,
        outboundTrunkId
      });

      return {
        success: true,
        roomName,
        participant: participantResult.participant,
        trunk: trunkResult.trunk
      };

    } catch (error) {
      console.error('Error creating outbound call:', error);
      throw error;
    }
  }
}

export const livekitOutboundService = new LiveKitOutboundService();
export { LiveKitOutboundService };

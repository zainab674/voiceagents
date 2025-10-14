// services/call-history-service.js
import { createClient } from '@supabase/supabase-js';

class CallHistoryService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Save comprehensive call history to database
   * @param {Object} callData - Complete call data
   * @returns {Promise<Object>} - Result with success status and data
   */
  async saveCallHistory(callData) {
    try {
      console.log('Saving comprehensive call history:', {
        callId: callData.call_id,
        assistantId: callData.assistant_id,
        duration: callData.call_duration,
        transcriptionItems: callData.transcription?.length || 0,
        outcome: callData.call_outcome
      });

      // Prepare the data for the calls table (using only existing fields)
      const callsTableData = {
        agent_id: callData.assistant_id,
        user_id: callData.user_id,
        contact_name: callData.contact_name,
        contact_phone: callData.phone_number,
        status: callData.call_status || 'completed',
        duration_seconds: callData.call_duration,
        outcome: callData.outcome || 'completed',
        notes: callData.notes,
        started_at: callData.start_time,
        ended_at: callData.end_time,
        success: callData.success || false,
        
        // Fields you already have
        transcription: callData.transcription || [],
        call_sid: callData.call_sid
      };

      // Insert into calls table
      const { data, error } = await this.supabase
        .from('calls')
        .insert(callsTableData)
        .select()
        .single();

      if (error) {
        console.error('Error saving call history:', error);
        return { success: false, error: error.message };
      }

      console.log('Call history saved successfully:', {
        callId: data.id,
        duration: data.duration_seconds,
        outcome: data.call_outcome,
        transcriptionItems: data.transcription?.length || 0
      });

      return { success: true, data };

    } catch (error) {
      console.error('Exception saving call history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update existing call with additional data
   * @param {string} callId - Call ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Result with success status
   */
  async updateCallHistory(callId, updateData) {
    try {
      console.log('Updating call history:', { callId, updateFields: Object.keys(updateData) });

      const { data, error } = await this.supabase
        .from('calls')
        .update(updateData)
        .eq('id', callId)
        .select()
        .single();

      if (error) {
        console.error('Error updating call history:', error);
        return { success: false, error: error.message };
      }

      console.log('Call history updated successfully:', { callId });
      return { success: true, data };

    } catch (error) {
      console.error('Exception updating call history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get call history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Result with call history data
   */
  async getCallHistory(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, agentId = null } = options;

      let query = this.supabase
        .from('calls')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call history:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };

    } catch (error) {
      console.error('Exception fetching call history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get call details by ID
   * @param {string} callId - Call ID
   * @param {string} userId - User ID for security
   * @returns {Promise<Object>} - Result with call data
   */
  async getCallById(callId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching call by ID:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };

    } catch (error) {
      console.error('Exception fetching call by ID:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process session history into transcription format
   * @param {Array} sessionHistory - Raw session history
   * @returns {Array} - Processed transcription
   */
  processTranscription(sessionHistory) {
    const transcription = [];
    
    for (const item of sessionHistory) {
      if (typeof item === 'object' && item.role && item.content) {
        let content = item.content;
        
        // Handle different content formats
        if (Array.isArray(content)) {
          content = content
            .filter(c => c && String(c).trim())
            .map(c => String(c).trim())
            .join(' ');
        } else if (typeof content !== 'string') {
          content = String(content);
        }
        
        // Only add non-empty content
        if (content && content.trim()) {
          transcription.push({
            role: item.role,
            content: content.trim()
          });
        }
      }
    }
    
    return transcription;
  }

  /**
   * Extract phone number from room name
   * @param {string} roomName - LiveKit room name
   * @returns {string|null} - Extracted phone number
   */
  extractPhoneFromRoom(roomName) {
    if (!roomName) return null;
    
    // Try to extract phone number from room name patterns
    const phoneMatch = roomName.match(/(\+?\d{10,15})/);
    return phoneMatch ? phoneMatch[1] : null;
  }

  /**
   * Extract call SID from various sources
   * @param {Object} participant - LiveKit participant
   * @param {Object} roomMetadata - Room metadata
   * @returns {string|null} - Call SID
   */
  extractCallSid(participant, roomMetadata) {
    let callSid = null;
    
    try {
      // Try participant attributes
      if (participant?.attributes) {
        callSid = participant.attributes['sip.twilio.callSid'] || 
                 participant.attributes?.sip?.twilio?.callSid;
      }
      
      // Try room metadata
      if (!callSid && roomMetadata) {
        callSid = roomMetadata.call_sid || 
                 roomMetadata.CallSid || 
                 roomMetadata.provider_id;
      }
      
    } catch (error) {
      console.warn('Error extracting call SID:', error);
    }
    
    return callSid;
  }
}

export default CallHistoryService;

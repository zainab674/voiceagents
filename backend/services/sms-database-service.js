// services/sms-database-service.js
import { createClient } from '@supabase/supabase-js';

class SMSDatabaseService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Save incoming SMS message to database
   */
  async saveIncomingSMS(smsData) {
    try {
      const { messageSid, toNumber, fromNumber, messageBody, userId } = smsData;

      const { data, error } = await this.supabase
        .from('sms_messages')
        .insert({
          message_sid: messageSid,
          user_id: userId,
          to_number: toNumber,
          from_number: fromNumber,
          body: messageBody,
          direction: 'inbound',
          status: 'received',
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving incoming SMS:', error);
        return null;
      }

      console.log('Incoming SMS saved successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error saving incoming SMS:', error);
      return null;
    }
  }

  /**
   * Save outgoing SMS message to database
   */
  async saveOutgoingSMS(smsData) {
    try {
      const { messageSid, toNumber, fromNumber, messageBody, status, userId } = smsData;

      const { data, error } = await this.supabase
        .from('sms_messages')
        .insert({
          message_sid: messageSid,
          user_id: userId,
          to_number: toNumber,
          from_number: fromNumber,
          body: messageBody,
          direction: 'outbound',
          status: status || 'sent',
          date_created: new Date().toISOString(),
          date_updated: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving outgoing SMS:', error);
        return null;
      }

      console.log('Outgoing SMS saved successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error saving outgoing SMS:', error);
      return null;
    }
  }

  /**
   * Get conversation history for SMS
   */
  async getConversationHistory(phoneNumber, assistantId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('sms_messages')
        .select('*')
        .or(`to_number.eq.${phoneNumber},from_number.eq.${phoneNumber}`)
        .order('date_created', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching conversation history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Check if this is a new conversation
   */
  async isNewConversation(phoneNumber, assistantId) {
    try {
      const { data, error } = await this.supabase
        .from('sms_messages')
        .select('id')
        .or(`to_number.eq.${phoneNumber},from_number.eq.${phoneNumber}`)
        .limit(1);

      if (error) {
        console.error('Error checking conversation status:', error);
        return true; // Assume new conversation on error
      }

      return !data || data.length === 0;
    } catch (error) {
      console.error('Error checking conversation status:', error);
      return true; // Assume new conversation on error
    }
  }

  /**
   * Get assistant by phone number
   */
  async getAssistantByPhoneNumber(phoneNumber) {
    try {
      // First try to find assistant by phone number in phone_number table
      const { data: phoneData, error: phoneError } = await this.supabase
        .from('phone_number')
        .select('inbound_assistant_id')
        .eq('number', phoneNumber)
        .eq('status', 'active')
        .single();

      if (phoneError || !phoneData?.inbound_assistant_id) {
        console.log(`No assistant found for phone number: ${phoneNumber}`);
        return null;
      }

      // Get assistant details
      const { data: assistant, error: assistantError } = await this.supabase
        .from('agents')
        .select('*')
        .eq('id', phoneData.inbound_assistant_id)
        .single();

      if (assistantError || !assistant) {
        console.error('Error fetching assistant:', assistantError);
        return null;
      }

      return assistant;
    } catch (error) {
      console.error('Error getting assistant by phone number:', error);
      return null;
    }
  }

  /**
   * Get user ID from assistant
   */
  async getUserIdFromAssistant(assistantId) {
    try {
      const { data, error } = await this.supabase
        .from('agents')
        .select('user_id')
        .eq('id', assistantId)
        .single();

      if (error || !data) {
        console.error('Error fetching user ID from assistant:', error);
        return null;
      }

      return data.user_id;
    } catch (error) {
      console.error('Error getting user ID from assistant:', error);
      return null;
    }
  }

  /**
   * Update SMS message status
   */
  async updateSMSStatus(messageSid, status, errorCode = null, errorMessage = null) {
    try {
      const updateData = {
        status,
        date_updated: new Date().toISOString()
      };

      if (errorCode) updateData.error_code = errorCode;
      if (errorMessage) updateData.error_message = errorMessage;

      const { data, error } = await this.supabase
        .from('sms_messages')
        .update(updateData)
        .eq('message_sid', messageSid)
        .select()
        .single();

      if (error) {
        console.error('Error updating SMS status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating SMS status:', error);
      return null;
    }
  }

  /**
   * Get SMS messages for a conversation
   */
  async getSMSMessages(conversationId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('sms_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('date_created', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching SMS messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching SMS messages:', error);
      return [];
    }
  }

  /**
   * Get SMS statistics for a user
   */
  async getSMSStats(userId, startDate = null, endDate = null) {
    try {
      let query = this.supabase
        .from('sms_messages')
        .select('direction, status, date_created')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('date_created', startDate);
      }
      if (endDate) {
        query = query.lte('date_created', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching SMS stats:', error);
        return null;
      }

      const stats = {
        total: data.length,
        inbound: data.filter(msg => msg.direction === 'inbound').length,
        outbound: data.filter(msg => msg.direction === 'outbound').length,
        sent: data.filter(msg => msg.status === 'sent').length,
        delivered: data.filter(msg => msg.status === 'delivered').length,
        failed: data.filter(msg => msg.status === 'failed').length
      };

      return stats;
    } catch (error) {
      console.error('Error getting SMS stats:', error);
      return null;
    }
  }
}

export { SMSDatabaseService };

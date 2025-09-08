// services/phoneNumberService.js
import { createClient } from '@supabase/supabase-js';

const supa = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export class PhoneNumberService {
  /**
   * Get all phone numbers for a user
   */
  static async getPhoneNumbers(userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { data, error } = await supa
        .from('phone_number')
        .select(`
          *,
          agents:inbound_assistant_id (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching phone numbers:', error);
        return { success: false, message: 'Failed to fetch phone numbers' };
      }

      return { success: true, phoneNumbers: data || [] };
    } catch (error) {
      console.error('PhoneNumberService.getPhoneNumbers error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Get a specific phone number by ID
   */
  static async getPhoneNumberById(phoneNumberId, userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { data, error } = await supa
        .from('phone_number')
        .select(`
          *,
          agents:inbound_assistant_id (
            id,
            name,
            description
          )
        `)
        .eq('id', phoneNumberId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, message: 'Phone number not found' };
        }
        console.error('Error fetching phone number:', error);
        return { success: false, message: 'Failed to fetch phone number' };
      }

      return { success: true, phoneNumber: data };
    } catch (error) {
      console.error('PhoneNumberService.getPhoneNumberById error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Create or update a phone number
   */
  static async upsertPhoneNumber(phoneNumberData, userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { data, error } = await supa
        .from('phone_number')
        .upsert({
          ...phoneNumberData,
          user_id: userId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'number'
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting phone number:', error);
        return { success: false, message: 'Failed to save phone number' };
      }

      return { success: true, phoneNumber: data };
    } catch (error) {
      console.error('PhoneNumberService.upsertPhoneNumber error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Update a phone number
   */
  static async updatePhoneNumber(phoneNumberId, updateData, userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { data, error } = await supa
        .from('phone_number')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', phoneNumberId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, message: 'Phone number not found' };
        }
        console.error('Error updating phone number:', error);
        return { success: false, message: 'Failed to update phone number' };
      }

      return { success: true, phoneNumber: data };
    } catch (error) {
      console.error('PhoneNumberService.updatePhoneNumber error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Delete a phone number
   */
  static async deletePhoneNumber(phoneNumberId, userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { error } = await supa
        .from('phone_number')
        .delete()
        .eq('id', phoneNumberId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting phone number:', error);
        return { success: false, message: 'Failed to delete phone number' };
      }

      return { success: true, message: 'Phone number deleted successfully' };
    } catch (error) {
      console.error('PhoneNumberService.deletePhoneNumber error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Get phone numbers by assistant ID
   */
  static async getPhoneNumbersByAssistant(assistantId, userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { data, error } = await supa
        .from('phone_number')
        .select('*')
        .eq('inbound_assistant_id', assistantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching phone numbers by assistant:', error);
        return { success: false, message: 'Failed to fetch phone numbers' };
      }

      return { success: true, phoneNumbers: data || [] };
    } catch (error) {
      console.error('PhoneNumberService.getPhoneNumbersByAssistant error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }

  /**
   * Check if a phone number is already assigned
   */
  static async isPhoneNumberAssigned(phoneNumber, userId) {
    try {
      if (!supa) {
        return { success: false, message: 'Database connection not configured' };
      }

      const { data, error } = await supa
        .from('phone_number')
        .select('id, inbound_assistant_id, status')
        .eq('number', phoneNumber)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, assigned: false };
        }
        console.error('Error checking phone number assignment:', error);
        return { success: false, message: 'Failed to check phone number assignment' };
      }

      return { 
        success: true, 
        assigned: !!data.inbound_assistant_id && data.status === 'active',
        phoneNumberId: data.id,
        assistantId: data.inbound_assistant_id
      };
    } catch (error) {
      console.error('PhoneNumberService.isPhoneNumberAssigned error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }
}

// Export convenience functions
export const getPhoneNumbers = (userId) => PhoneNumberService.getPhoneNumbers(userId);
export const getPhoneNumberById = (phoneNumberId, userId) => PhoneNumberService.getPhoneNumberById(phoneNumberId, userId);
export const upsertPhoneNumber = (phoneNumberData, userId) => PhoneNumberService.upsertPhoneNumber(phoneNumberData, userId);
export const updatePhoneNumber = (phoneNumberId, updateData, userId) => PhoneNumberService.updatePhoneNumber(phoneNumberId, updateData, userId);
export const deletePhoneNumber = (phoneNumberId, userId) => PhoneNumberService.deletePhoneNumber(phoneNumberId, userId);
export const getPhoneNumbersByAssistant = (assistantId, userId) => PhoneNumberService.getPhoneNumbersByAssistant(assistantId, userId);
export const isPhoneNumberAssigned = (phoneNumber, userId) => PhoneNumberService.isPhoneNumberAssigned(phoneNumber, userId);

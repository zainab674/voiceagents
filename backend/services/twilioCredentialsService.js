import "dotenv/config";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = createClient(supabaseUrl, supabaseKey);

/**
 * Service for managing user-specific Twilio credentials
 */
export class TwilioCredentialsService {
  /**
   * Get the active Twilio credentials for a specific user
   */
  static async getActiveCredentials(userId) {
    try {
      const { data, error } = await supa
        .from("user_twilio_credentials")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error fetching Twilio credentials:", error);
      return null;
    }
  }

  /**
   * Save new Twilio credentials for a user
   */
  static async saveCredentials(userId, credentials) {
    try {
      // First, deactivate any existing active credentials for this user
      await supa
        .from("user_twilio_credentials")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);

      // Then insert the new credentials as active
      const { data, error } = await supa
        .from("user_twilio_credentials")
        .insert({
          user_id: userId,
          account_sid: credentials.accountSid,
          auth_token: credentials.authToken,
          trunk_sid: credentials.trunkSid,
          label: credentials.label,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error saving Twilio credentials:", error);
      throw error;
    }
  }

  /**
   * Update existing Twilio credentials
   */
  static async updateCredentials(credentialsId, userId, credentials) {
    try {
      const updateData = {};
      if (credentials.accountSid) updateData.account_sid = credentials.accountSid;
      if (credentials.authToken) updateData.auth_token = credentials.authToken;
      if (credentials.trunkSid) updateData.trunk_sid = credentials.trunkSid;
      if (credentials.label) updateData.label = credentials.label;

      const { data, error } = await supa
        .from("user_twilio_credentials")
        .update(updateData)
        .eq("id", credentialsId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error updating Twilio credentials:", error);
      throw error;
    }
  }

  /**
   * Delete Twilio credentials
   */
  static async deleteCredentials(credentialsId, userId) {
    try {
      const { error } = await supa
        .from("user_twilio_credentials")
        .delete()
        .eq("id", credentialsId)
        .eq("user_id", userId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting Twilio credentials:", error);
      throw error;
    }
  }

  /**
   * Get all Twilio credentials for a user
   */
  static async getAllCredentials(userId) {
    try {
      const { data, error } = await supa
        .from("user_twilio_credentials")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error("Error fetching all Twilio credentials:", error);
      return [];
    }
  }

  /**
   * Set specific credentials as active
   */
  static async setActiveCredentials(credentialsId, userId) {
    try {
      // First, deactivate all credentials for this user
      await supa
        .from("user_twilio_credentials")
        .update({ is_active: false })
        .eq("user_id", userId);

      // Then activate the specified credentials
      const { data, error } = await supa
        .from("user_twilio_credentials")
        .update({ is_active: true })
        .eq("id", credentialsId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error setting active Twilio credentials:", error);
      throw error;
    }
  }

  /**
   * Test Twilio credentials by validating format
   */
  static async testCredentials(credentials) {
    try {
      // Validate the format
      const accountSidPattern = /^AC[a-f0-9]{32}$/;
      const authTokenPattern = /^[a-f0-9]{32}$/;

      return (
        accountSidPattern.test(credentials.accountSid) &&
        authTokenPattern.test(credentials.authToken)
      );
    } catch (error) {
      console.error("Error testing Twilio credentials:", error);
      return false;
    }
  }

  /**
   * Create Twilio client with user's credentials
   */
  static async createTwilioClient(userId) {
    try {
      const credentials = await this.getActiveCredentials(userId);
      if (!credentials) {
        throw new Error("No active Twilio credentials found for user");
      }

      const Twilio = (await import('twilio')).default;
      return Twilio(credentials.account_sid, credentials.auth_token);
    } catch (error) {
      console.error("Error creating Twilio client:", error);
      throw error;
    }
  }
}

// Export convenience functions
export const getActiveTwilioCredentials = (userId) => TwilioCredentialsService.getActiveCredentials(userId);
export const saveTwilioCredentials = (userId, credentials) => TwilioCredentialsService.saveCredentials(userId, credentials);
export const updateTwilioCredentials = (id, userId, credentials) => TwilioCredentialsService.updateCredentials(id, userId, credentials);
export const deleteTwilioCredentials = (id, userId) => TwilioCredentialsService.deleteCredentials(id, userId);
export const getAllTwilioCredentials = (userId) => TwilioCredentialsService.getAllCredentials(userId);
export const setActiveTwilioCredentials = (id, userId) => TwilioCredentialsService.setActiveCredentials(id, userId);
export const testTwilioCredentials = (credentials) => TwilioCredentialsService.testCredentials(credentials);
export const createTwilioClient = (userId) => TwilioCredentialsService.createTwilioClient(userId);

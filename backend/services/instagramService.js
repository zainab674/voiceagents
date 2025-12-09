import "dotenv/config";
import { supabase } from "#lib/supabase.js";

/**
 * Service for managing user-specific Instagram / Meta credentials
 *
 * This is intentionally simple and mirrors the Twilio credentials pattern:
 * - One or more credential records per user
 * - A single "active" record used for webhooks + API calls
 */
export class InstagramCredentialsService {
  /**
   * Get the active Instagram credentials for a specific user
   */
  static async getActiveCredentials(userId) {
    try {
      const { data, error } = await supabase
        .from("user_instagram_credentials")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error("Error fetching Instagram credentials:", error);
      return null;
    }
  }

  /**
   * Save (or replace) active Instagram credentials for a user
   */
  static async saveCredentials(userId, payload) {
    try {
      // Deactivate existing active credentials
      await supabase
        .from("user_instagram_credentials")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);

      const { data, error } = await supabase
        .from("user_instagram_credentials")
        .insert({
          user_id: userId,
          platform_type: payload.platformType || "facebook_login",
          app_id: payload.appId || null,
          app_secret: payload.appSecret || null,
          verify_token: payload.verifyToken || null,
          page_id: payload.pageId || null,
          instagram_business_id: payload.instagramBusinessId || null,
          long_lived_access_token: payload.longLivedAccessToken || null,
          is_active: true
        })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error saving Instagram credentials:", error);
      throw error;
    }
  }
}

export const getActiveInstagramCredentials = (userId) =>
  InstagramCredentialsService.getActiveCredentials(userId);

export const saveInstagramCredentials = (userId, payload) =>
  InstagramCredentialsService.saveCredentials(userId, payload);




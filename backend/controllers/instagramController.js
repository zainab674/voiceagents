import { getActiveInstagramCredentials, saveInstagramCredentials } from "#services/instagramService.js";

/**
 * Get active Instagram / Meta credentials for the authenticated user
 */
export const getInstagramConfig = async (req, res) => {
  try {
    const userId = req.user.userId;
    const creds = await getActiveInstagramCredentials(userId);

    if (!creds) {
      return res.status(200).json({
        success: true,
        config: null
      });
    }

    // Do not return app_secret or long_lived_access_token in responses
    const {
      app_secret,
      long_lived_access_token,
      ...safe
    } = creds;

    return res.status(200).json({
      success: true,
      config: safe
    });
  } catch (error) {
    console.error("Error fetching Instagram config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Instagram configuration"
    });
  }
};

/**
 * Save / update Instagram / Meta credentials for the authenticated user
 */
export const saveInstagramConfig = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      platformType,
      appId,
      appSecret,
      verifyToken,
      pageId,
      instagramBusinessId,
      longLivedAccessToken
    } = req.body;

    if (!appId || !appSecret || !verifyToken) {
      return res.status(400).json({
        success: false,
        message: "appId, appSecret and verifyToken are required"
      });
    }

    const record = await saveInstagramCredentials(userId, {
      platformType,
      appId,
      appSecret,
      verifyToken,
      pageId,
      instagramBusinessId,
      longLivedAccessToken
    });

    const { app_secret, long_lived_access_token, ...safe } = record;

    return res.status(200).json({
      success: true,
      message: "Instagram configuration saved",
      config: safe
    });
  } catch (error) {
    console.error("Error saving Instagram config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save Instagram configuration"
    });
  }
};

/**
 * Webhook verification endpoint (GET)
 *
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 */
export const verifyInstagramWebhook = async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (!mode || !token || !challenge) {
      return res.status(400).send("Missing verification parameters");
    }

    // For now, accept if the token matches any stored verify_token.
    // This keeps things simple while still providing basic security.
    const { data, error } = await (await import("#lib/supabase.js")).supabase
      .from("user_instagram_credentials")
      .select("id, verify_token")
      .eq("verify_token", token)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking verify_token:", error);
    }

    if (!data) {
      return res.status(403).send("Verification token mismatch");
    }

    return res.status(200).send(challenge);
  } catch (error) {
    console.error("Error in verifyInstagramWebhook:", error);
    return res.status(500).send("Server error");
  }
};

/**
 * Webhook receiver endpoint (POST)
 *
 * Right now we just log and 200 OK. You can wire this into your agent later.
 */
export const handleInstagramWebhook = async (req, res) => {
  try {
    const body = req.body;
    console.log("📥 Instagram webhook payload:", JSON.stringify(body, null, 2));

    // TODO: Map incoming messages / comments to your agents and respond via the
    // Messenger Instagram Messaging API.

    return res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error("Error handling Instagram webhook:", error);
    return res.status(500).send("Server error");
  }
};




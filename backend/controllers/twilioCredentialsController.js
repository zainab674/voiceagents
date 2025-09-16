import { 
  getActiveTwilioCredentials,
  saveTwilioCredentials,
  updateTwilioCredentials,
  deleteTwilioCredentials,
  getAllTwilioCredentials,
  setActiveTwilioCredentials,
  testTwilioCredentials,
  createTwilioClient
} from "#services/twilioCredentialsService.js";
import { createMainTrunkForUser } from "#services/twilio-trunk-service.js";

/**
 * Get active Twilio credentials for the authenticated user
 */
export const getActiveCredentials = async (req, res) => {
  try {
    const userId = req.user.userId; // Get userId from auth middleware
    
    const credentials = await getActiveTwilioCredentials(userId);
    
    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: "No active Twilio credentials found"
      });
    }

    // Don't return sensitive auth_token in response
    const { auth_token, ...safeCredentials } = credentials;
    
    res.json({
      success: true,
      credentials: safeCredentials
    });
  } catch (error) {
    console.error("Error fetching active Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Twilio credentials"
    });
  }
};

/**
 * Save new Twilio credentials for the authenticated user
 */
export const saveCredentials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountSid, authToken, label } = req.body;

    // Validate required fields (trunkSid is now optional)
    if (!accountSid || !authToken || !label) {
      return res.status(400).json({
        success: false,
        message: "accountSid, authToken, and label are required"
      });
    }

    // Test credentials format (without trunkSid)
    const isValid = await testTwilioCredentials({
      accountSid,
      authToken
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid Twilio credentials format"
      });
    }

    // Create main elastic SIP trunk for the user with SIP configuration
    let trunkResult;
    try {
      trunkResult = await createMainTrunkForUser({
        accountSid,
        authToken,
        userId,
        label
      });
      
      if (!trunkResult.success) {
        throw new Error(trunkResult.message || 'Failed to create trunk');
      }
      
      console.log(`Created main trunk ${trunkResult.trunkSid} for user ${userId}`);
    } catch (trunkError) {
      console.error('Error creating main trunk:', trunkError);
      return res.status(500).json({
        success: false,
        message: `Failed to create main trunk: ${trunkError.message}`
      });
    }

    // The trunk service already saves the credentials with SIP configuration
    // Just return the result from the trunk creation
    const credentials = {
      user_id: userId,
      account_sid: accountSid,
      auth_token: authToken,
      trunk_sid: trunkResult.trunkSid,
      label: label,
      domain_name: trunkResult.domainName,
      domain_prefix: trunkResult.domainPrefix,
      credential_list_sid: trunkResult.credentialListSid,
      sip_username: trunkResult.sipUsername,
      sip_password: trunkResult.sipPassword,
      is_active: true
    };

    // Don't return sensitive auth_token in response
    const { auth_token, ...safeCredentials } = credentials;

    res.status(201).json({
      success: true,
      message: "Twilio credentials saved successfully with main elastic SIP trunk created",
      credentials: safeCredentials,
      trunkInfo: {
        trunkSid: trunkResult.trunkSid,
        domainName: trunkResult.domainName,
        domainPrefix: trunkResult.domainPrefix,
        credentialListSid: trunkResult.credentialListSid,
        sipUsername: trunkResult.sipUsername,
        message: "Main trunk created with SIP configuration and LiveKit origination URL"
      }
    });
  } catch (error) {
    console.error("Error saving Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save Twilio credentials"
    });
  }
};

/**
 * Update existing Twilio credentials
 */
export const updateCredentials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { accountSid, authToken, trunkSid, label } = req.body;

    // Validate that at least one field is provided
    if (!accountSid && !authToken && !trunkSid && !label) {
      return res.status(400).json({
        success: false,
        message: "At least one field must be provided for update"
      });
    }

    // If credentials are being updated, test their format
    if (accountSid || authToken || trunkSid) {
      const currentCredentials = await getActiveTwilioCredentials(userId);
      if (!currentCredentials) {
        return res.status(404).json({
          success: false,
          message: "No credentials found to update"
        });
      }

      const testCredentials = {
        accountSid: accountSid || currentCredentials.account_sid,
        authToken: authToken || currentCredentials.auth_token,
        trunkSid: trunkSid || currentCredentials.trunk_sid
      };

      const isValid = await testTwilioCredentials(testCredentials);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid Twilio credentials format"
        });
      }
    }

    const credentials = await updateTwilioCredentials(id, userId, {
      accountSid,
      authToken,
      trunkSid,
      label
    });

    // Don't return sensitive auth_token in response
    const { auth_token, ...safeCredentials } = credentials;

    res.json({
      success: true,
      message: "Twilio credentials updated successfully",
      credentials: safeCredentials
    });
  } catch (error) {
    console.error("Error updating Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update Twilio credentials"
    });
  }
};

/**
 * Delete Twilio credentials
 */
export const deleteCredentials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await deleteTwilioCredentials(id, userId);

    res.json({
      success: true,
      message: "Twilio credentials deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete Twilio credentials"
    });
  }
};

/**
 * Get all Twilio credentials for the authenticated user
 */
export const getAllCredentials = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const credentials = await getAllTwilioCredentials(userId);
    
    // Don't return sensitive auth_token in response
    const safeCredentials = credentials.map(({ auth_token, ...cred }) => cred);

    res.json({
      success: true,
      credentials: safeCredentials
    });
  } catch (error) {
    console.error("Error fetching all Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Twilio credentials"
    });
  }
};

/**
 * Set specific credentials as active
 */
export const setActiveCredentials = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const credentials = await setActiveTwilioCredentials(id, userId);

    // Don't return sensitive auth_token in response
    const { auth_token, ...safeCredentials } = credentials;

    res.json({
      success: true,
      message: "Active Twilio credentials updated successfully",
      credentials: safeCredentials
    });
  } catch (error) {
    console.error("Error setting active Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set active Twilio credentials"
    });
  }
};

/**
 * Test Twilio credentials
 */
export const testCredentials = async (req, res) => {
  try {
    const { accountSid, authToken, trunkSid } = req.body;

    if (!accountSid || !authToken || !trunkSid) {
      return res.status(400).json({
        success: false,
        message: "accountSid, authToken, and trunkSid are required"
      });
    }

    const isValid = await testTwilioCredentials({
      accountSid,
      authToken,
      trunkSid
    });

    res.json({
      success: true,
      isValid,
      message: isValid ? "Credentials format is valid" : "Invalid credentials format"
    });
  } catch (error) {
    console.error("Error testing Twilio credentials:", error);
    res.status(500).json({
      success: false,
      message: "Failed to test Twilio credentials"
    });
  }
};

/**
 * Create main trunk for user (auto-generated with SIP configuration)
 */
export const createMainTrunk = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountSid, authToken, label } = req.body;

    if (!accountSid || !authToken || !label) {
      return res.status(400).json({
        success: false,
        message: "accountSid, authToken, and label are required"
      });
    }

    // Create main trunk for the user with SIP configuration
    const trunkResult = await createMainTrunkForUser({
      accountSid,
      authToken,
      userId,
      label
    });

    if (!trunkResult.success) {
      return res.status(500).json({
        success: false,
        message: trunkResult.message || 'Failed to create main trunk'
      });
    }

    res.json({
      success: true,
      message: 'Main trunk created successfully with SIP configuration',
      trunkSid: trunkResult.trunkSid,
      trunkName: trunkResult.trunkName,
      domainName: trunkResult.domainName,
      domainPrefix: trunkResult.domainPrefix,
      credentialListSid: trunkResult.credentialListSid,
      sipUsername: trunkResult.sipUsername,
      sipPassword: trunkResult.sipPassword
    });
  } catch (error) {
    console.error('Error creating main trunk:', error);
    res.status(500).json({
      success: false,
      message: `Failed to create main trunk: ${error.message}`
    });
  }
};

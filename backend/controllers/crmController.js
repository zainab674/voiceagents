import { MultiCRMService, HubSpotService, ZohoService } from '../services/crm-service.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate OAuth URL for HubSpot using user credentials
 */
const getHubSpotOAuthUrl = (clientId, redirectUri, state) => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'crm.objects.contacts.read oauth crm.objects.contacts.write',
    state: state
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
};

/**
 * Generate OAuth URL for Zoho using user credentials
 */
const getZohoOAuthUrl = (clientId, redirectUri, state) => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'ZohoCRM.modules.ALL',
    response_type: 'code',
    access_type: 'offline',
    state: state
  });

  return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
};

/**
 * Generate random state parameter for OAuth security
 */
const generateRandomState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Store OAuth state in database
 */
const storeOAuthState = async (userId, state, platform) => {
  const { error } = await supabase
    .from('oauth_states')
    .insert({
      user_id: userId,
      state: state,
      platform: platform
    });

  if (error) {
    throw new Error(`Failed to store OAuth state: ${error.message}`);
  }
};

/**
 * Get userId from OAuth state (for callbacks)
 */
const getUserIdFromState = async (state, platform) => {
  const { data, error } = await supabase
    .from('oauth_states')
    .select('user_id')
    .eq('state', state)
    .eq('platform', platform)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data.user_id;
};

/**
 * Verify OAuth state parameter
 */
const verifyOAuthState = async (userId, state, platform) => {
  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('user_id', userId)
    .eq('state', state)
    .eq('platform', platform)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return false;
  }

  // Clean up the used state
  await supabase
    .from('oauth_states')
    .delete()
    .eq('id', data.id);

  return true;
};

/**
 * Verify OAuth state and return userId (for callbacks)
 */
const verifyOAuthStateAndGetUserId = async (state, platform) => {
  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .eq('platform', platform)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  // Clean up the used state
  await supabase
    .from('oauth_states')
    .delete()
    .eq('id', data.id);

  return data.user_id;
};

/**
 * Exchange authorization code for access token (HubSpot) using user credentials
 */
const exchangeHubSpotCode = async (code, clientId, clientSecret, redirectUri) => {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    })
  });

  if (!response.ok) {
    throw new Error(`HubSpot token exchange failed: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Exchange authorization code for access token (Zoho) using user credentials
 */
const exchangeZohoCode = async (code, clientId, clientSecret, redirectUri) => {
  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    })
  });

  if (!response.ok) {
    throw new Error(`Zoho token exchange failed: ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Store CRM credentials in database
 */
const storeCRMCredentials = async (userId, platform, tokens) => {
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const credentialData = {
    user_id: userId,
    crm_platform: platform,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expires_at: expiresAt,
    scope: tokens.scope || null,
    account_id: tokens.account_id || null,
    account_name: tokens.account_name || `${platform} Account`
  };

  // Deactivate any existing credentials for this platform
  await supabase
    .from('user_crm_credentials')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('crm_platform', platform);

  // Insert new credentials
  const { data, error } = await supabase
    .from('user_crm_credentials')
    .insert(credentialData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store ${platform} credentials: ${error.message}`);
  }

  return data;
};

/**
 * Get account information for HubSpot
 */
const getHubSpotAccountInfo = async (accessToken) => {
  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/accounts?limit=1', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.results?.[0] || null;
    }
  } catch (error) {
    console.error('Error fetching HubSpot account info:', error);
  }
  return null;
};

/**
 * Get account information for Zoho
 */
const getZohoAccountInfo = async (accessToken) => {
  try {
    const response = await fetch('https://www.zohoapis.com/crm/v2/Accounts?page=1&per_page=1', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.data?.[0] || null;
    }
  } catch (error) {
    console.error('Error fetching Zoho account info:', error);
  }
  return null;
};

// Controller functions

/**
 * Store user CRM app credentials
 */
export const storeCRMAppCredentials = async (req, res) => {
  try {
    const { userId } = req.user;
    const { platform, clientId, clientSecret, redirectUri } = req.body;

    if (!platform || !clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: platform, clientId, clientSecret, redirectUri'
      });
    }

    if (!['hubspot', 'zoho'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Must be hubspot or zoho'
      });
    }

    // Check if an active record already exists
    const { data: existingRecord, error: checkError } = await supabase
      .from('user_crm_app_credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('crm_platform', platform)
      .eq('is_active', true)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check existing ${platform} app credentials: ${checkError.message}`);
    }

    let data;
    let error;

    if (existingRecord) {
      // Update existing active record
      const updateResult = await supabase
        .from('user_crm_app_credentials')
        .update({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      data = updateResult.data;
      error = updateResult.error;
    } else {
      // Deactivate any existing active records for this platform (shouldn't happen due to constraint, but safety check)
      await supabase
        .from('user_crm_app_credentials')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('crm_platform', platform)
        .eq('is_active', true);

      // Insert new app credentials
      const insertResult = await supabase
        .from('user_crm_app_credentials')
        .insert({
          user_id: userId,
          crm_platform: platform,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          is_active: true
        })
        .select()
        .single();

      data = insertResult.data;
      error = insertResult.error;
    }

    if (error) {
      throw new Error(`Failed to store ${platform} app credentials: ${error.message}`);
    }

    res.json({
      success: true,
      credentials: data,
      message: `${platform} app credentials stored successfully`
    });
  } catch (error) {
    console.error('Store CRM app credentials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store CRM app credentials',
      error: error.message
    });
  }
};

/**
 * Get user CRM app credentials
 */
export const getCRMAppCredentials = async (req, res) => {
  try {
    const { userId } = req.user;

    const { data, error } = await supabase
      .from('user_crm_app_credentials')
      .select('id, crm_platform, client_id, redirect_uri, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get CRM app credentials: ${error.message}`);
    }

    res.json({
      success: true,
      credentials: data
    });
  } catch (error) {
    console.error('Get CRM app credentials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get CRM app credentials',
      error: error.message
    });
  }
};

/**
 * Initiate OAuth flow for HubSpot using user credentials
 */
export const initiateHubSpotOAuth = async (req, res) => {
  try {
    const { userId } = req.user;
    const state = generateRandomState();

    // Get user's HubSpot app credentials
    const { data: appCredentials, error: appError } = await supabase
      .from('user_crm_app_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_platform', 'hubspot')
      .eq('is_active', true)
      .single();

    if (appError || !appCredentials) {
      return res.status(400).json({
        success: false,
        message: 'HubSpot app credentials not found. Please configure your HubSpot app first.'
      });
    }

    await storeOAuthState(userId, state, 'hubspot');

    const authUrl = getHubSpotOAuthUrl(appCredentials.client_id, appCredentials.redirect_uri, state);

    // If request accepts JSON (API call), return JSON. Otherwise redirect (browser direct access)
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        authUrl: authUrl
      });
    }

    // Browser redirect for direct access
    res.redirect(authUrl);
  } catch (error) {
    console.error('HubSpot OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate HubSpot OAuth',
      error: error.message
    });
  }
};

/**
 * Handle HubSpot OAuth callback
 */
export const handleHubSpotCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Get frontend URL from environment variable
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const dashboardUrl = `${frontendUrl}/dashboard`;

    if (oauthError) {
      return res.redirect(`${dashboardUrl}?crm_error=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect(`${dashboardUrl}?crm_error=missing_parameters`);
    }

    // Get userId from state parameter (callbacks don't have auth tokens)
    const userId = await verifyOAuthStateAndGetUserId(state, 'hubspot');
    if (!userId) {
      return res.redirect(`${dashboardUrl}?crm_error=invalid_state`);
    }

    // Get user's HubSpot app credentials
    const { data: appCredentials, error: appError } = await supabase
      .from('user_crm_app_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_platform', 'hubspot')
      .eq('is_active', true)
      .single();

    if (appError || !appCredentials) {
      return res.redirect(`${dashboardUrl}?crm_error=app_credentials_not_found`);
    }

    // Exchange code for tokens using user credentials
    const tokens = await exchangeHubSpotCode(code, appCredentials.client_id, appCredentials.client_secret, appCredentials.redirect_uri);

    // Get account information
    const accountInfo = await getHubSpotAccountInfo(tokens.access_token);
    if (accountInfo) {
      tokens.account_id = accountInfo.id;
      tokens.account_name = accountInfo.properties?.name || 'HubSpot Account';
    }

    // Store credentials
    await storeCRMCredentials(userId, 'hubspot', tokens);

    res.redirect(`${dashboardUrl}?crm_connected=hubspot`);
  } catch (error) {
    console.error('HubSpot OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard?crm_error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Initiate OAuth flow for Zoho using user credentials
 */
export const initiateZohoOAuth = async (req, res) => {
  try {
    const { userId } = req.user;
    const state = generateRandomState();

    // Get user's Zoho app credentials
    const { data: appCredentials, error: appError } = await supabase
      .from('user_crm_app_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_platform', 'zoho')
      .eq('is_active', true)
      .single();

    if (appError || !appCredentials) {
      return res.status(400).json({
        success: false,
        message: 'Zoho app credentials not found. Please configure your Zoho app first.'
      });
    }

    await storeOAuthState(userId, state, 'zoho');

    const authUrl = getZohoOAuthUrl(appCredentials.client_id, appCredentials.redirect_uri, state);

    // If request accepts JSON (API call), return JSON. Otherwise redirect (browser direct access)
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        authUrl: authUrl
      });
    }

    // Browser redirect for direct access
    res.redirect(authUrl);
  } catch (error) {
    console.error('Zoho OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Zoho OAuth',
      error: error.message
    });
  }
};

/**
 * Handle Zoho OAuth callback
 */
export const handleZohoCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Get frontend URL from environment variable
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const dashboardUrl = `${frontendUrl}/dashboard`;

    if (oauthError) {
      return res.redirect(`${dashboardUrl}?crm_error=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect(`${dashboardUrl}?crm_error=missing_parameters`);
    }

    // Get userId from state parameter (callbacks don't have auth tokens)
    const userId = await verifyOAuthStateAndGetUserId(state, 'zoho');
    if (!userId) {
      return res.redirect(`${dashboardUrl}?crm_error=invalid_state`);
    }

    // Get user's Zoho app credentials
    const { data: appCredentials, error: appError } = await supabase
      .from('user_crm_app_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('crm_platform', 'zoho')
      .eq('is_active', true)
      .single();

    if (appError || !appCredentials) {
      return res.redirect(`${dashboardUrl}?crm_error=app_credentials_not_found`);
    }

    // Exchange code for tokens using user credentials
    const tokens = await exchangeZohoCode(code, appCredentials.client_id, appCredentials.client_secret, appCredentials.redirect_uri);

    // Get account information
    const accountInfo = await getZohoAccountInfo(tokens.access_token);
    if (accountInfo) {
      tokens.account_id = accountInfo.id;
      tokens.account_name = accountInfo.Account_Name || 'Zoho Account';
    }

    // Store credentials
    await storeCRMCredentials(userId, 'zoho', tokens);

    res.redirect(`${dashboardUrl}?crm_connected=zoho`);
  } catch (error) {
    console.error('Zoho OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard?crm_error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Get user's CRM credentials
 */
export const getCRMCredentials = async (req, res) => {
  try {
    const { userId } = req.user;

    const { data, error } = await supabase
      .from('user_crm_credentials')
      .select('id, crm_platform, account_name, account_id, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get CRM credentials: ${error.message}`);
    }

    res.json({
      success: true,
      credentials: data
    });
  } catch (error) {
    console.error('Get CRM credentials error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get CRM credentials',
      error: error.message
    });
  }
};

/**
 * Sync contacts from all connected CRM platforms
 */
export const syncAllContacts = async (req, res) => {
  try {
    const { userId } = req.user;
    const multiCRMService = new MultiCRMService(userId);

    const results = await multiCRMService.syncAllPlatforms();

    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error('Sync all contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync contacts',
      error: error.message
    });
  }
};

/**
 * Sync contacts from specific CRM platform
 */
export const syncPlatformContacts = async (req, res) => {
  try {
    const { userId } = req.user;
    const { platform } = req.params;
    const multiCRMService = new MultiCRMService(userId);

    const result = await multiCRMService.syncPlatform(platform);

    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error('Sync platform contacts error:', error);
    res.status(500).json({
      success: false,
      message: `Failed to sync ${req.params.platform} contacts`,
      error: error.message
    });
  }
};

/**
 * Get stored CRM contacts
 */
export const getCRMContacts = async (req, res) => {
  try {
    const { userId } = req.user;
    const { platform, search, limit = 100, offset = 0 } = req.query;
    const multiCRMService = new MultiCRMService(userId);

    const filters = {
      platform: platform || undefined,
      search: search || undefined
    };

    const contacts = await multiCRMService.getStoredContacts(filters);

    // Apply pagination
    const paginatedContacts = contacts.slice(offset, offset + limit);

    res.json({
      success: true,
      contacts: paginatedContacts,
      total: contacts.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get CRM contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get CRM contacts',
      error: error.message
    });
  }
};

/**
 * Create contact in specific CRM platform
 */
export const createContactInPlatform = async (req, res) => {
  try {
    const { userId } = req.user;
    const { platform } = req.params;
    const contactData = req.body;
    const multiCRMService = new MultiCRMService(userId);

    const result = await multiCRMService.createContactInPlatform(platform, contactData);

    res.json({
      success: true,
      contact: result
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({
      success: false,
      message: `Failed to create contact in ${req.params.platform}`,
      error: error.message
    });
  }
};

/**
 * Disconnect CRM platform
 */
export const disconnectCRMPlatform = async (req, res) => {
  try {
    const { userId } = req.user;
    const { platform } = req.params;
    const multiCRMService = new MultiCRMService(userId);

    await multiCRMService.disconnectPlatform(platform);

    res.json({
      success: true,
      message: `${platform} disconnected successfully`
    });
  } catch (error) {
    console.error('Disconnect CRM platform error:', error);
    res.status(500).json({
      success: false,
      message: `Failed to disconnect ${req.params.platform}`,
      error: error.message
    });
  }
};

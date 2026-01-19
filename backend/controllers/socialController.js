import { supabase } from '#lib/supabase.js';
import { getUnipileClientForTenant, getUnipileConfigForTenant } from '#lib/unipileClient.js';

const SUPPORTED_PROVIDERS = [
  'WHATSAPP',
  'INSTAGRAM',
  'LINKEDIN',
  'TELEGRAM',
  'MESSENGER',
  'TWITTER',
  'EMAIL_GOOGLE',
  'EMAIL_MICROSOFT',
  'EMAIL_IMAP'
];

export const connectSocialAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantSlug = req.user.slugName || req.user.tenant || 'main';
    const { provider, reconnect = false, existingAccountId = null } = req.body;

    if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unsupported provider',
        details: `The provider "${provider || 'none'}" is not supported. Please select a supported provider.`,
        supportedProviders: SUPPORTED_PROVIDERS,
        troubleshooting: [
          'Select one of the supported providers listed above',
          'Ensure the provider name is spelled correctly and in uppercase',
          'Check if the provider is available in your Unipile plan'
        ]
      });
    }

    const client = await getUnipileClientForTenant(tenantSlug, userId);
    
    // Get the DSN and access token for verification
    const { dsn, accessToken } = await getUnipileConfigForTenant(tenantSlug, userId);
    if (!dsn) {
      return res.status(400).json({
        success: false,
        message: 'Unipile DSN not configured',
        details: 'Please configure your Unipile DSN in Website Settings before connecting social accounts.',
        troubleshooting: [
          'Go to Website Settings → Unipile Settings',
          'Enter your Unipile DSN (e.g., https://api23.unipile.com:15350)',
          'Save the settings and try again'
        ]
      });
    }
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Unipile Access Token not configured',
        details: 'Please configure your Unipile Access Token in Website Settings before connecting social accounts.',
        troubleshooting: [
          'Go to Website Settings → Unipile Settings',
          'Enter your Unipile Access Token from your Unipile dashboard',
          'Save the settings and try again'
        ]
      });
    }

    // Log configuration (without exposing full token)
    console.log('🔧 Unipile Config:', {
      dsn,
      accessTokenLength: accessToken?.length || 0,
      accessTokenPrefix: accessToken?.substring(0, 20) || 'N/A'
    });

    // Construct webhook URL
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl.replace(/\/+$/, '')}/api/social/webhook`;

    // Create hosted auth link using the correct SDK method
    const expiresOn = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now
    
    console.log('📡 Creating hosted auth link with params:', {
      type: reconnect ? 'reconnect' : 'create',
      providers: [provider],
      api_url: dsn,
      expiresOn,
      notify_url: webhookUrl,
      name: userId
    });
    
    try {
      const hostedAuthResponse = await client.account.createHostedAuthLink({
        type: reconnect ? 'reconnect' : 'create',
        providers: [provider], // Single provider array
        api_url: dsn,
        expiresOn: expiresOn,
        success_redirect_url: `${baseUrl.replace(/\/+$/, '')}/social-integrations?status=success`,
        failure_redirect_url: `${baseUrl.replace(/\/+$/, '')}/social-integrations?status=failure`,
        notify_url: webhookUrl,
        name: userId, // Pass userId so we can match it in the webhook
        ...(reconnect && existingAccountId ? { reconnect_account: existingAccountId } : {})
      });

      const hostedAuthUrl = hostedAuthResponse.url || null;
      // Note: account_id will come via webhook after user completes auth

      if (!hostedAuthUrl) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create authentication link',
          details: 'Unipile did not return a valid authentication URL. This may indicate a configuration issue.',
          troubleshooting: [
            'Verify your Unipile credentials are correct',
            'Check if your Unipile account is active',
            'Try again in a few moments',
            'Contact Unipile support if the issue persists'
          ]
        });
      }

      // Note: We don't have accountId yet - it will come via webhook after user completes auth
      // The webhook handler will create/update the social_accounts record

      return res.status(200).json({
        success: true,
        url: hostedAuthUrl
      });
    } catch (sdkError) {
      // Enhanced error logging for debugging
      console.error('❌ Unipile SDK Error:', {
        message: sdkError.message,
        status: sdkError.body?.status,
        type: sdkError.body?.type,
        title: sdkError.body?.title,
        body: sdkError.body
      });
      
      // Provide user-friendly error messages based on error type
      const errorStatus = sdkError.body?.status;
      const errorType = sdkError.body?.type;
      const errorTitle = sdkError.body?.title;
      
      if (errorStatus === 401) {
        return res.status(401).json({
          success: false,
          message: 'Unipile API authentication failed',
          details: 'Your Unipile API key is invalid, expired, or not activated. Please check your credentials in Website Settings.',
          error: errorTitle || 'Missing credentials',
          troubleshooting: [
            'Verify your API key is correct in Website Settings',
            'Check if your API key is active in your Unipile dashboard',
            'Ensure your IP address is whitelisted (if required)',
            'Try regenerating your API key in the Unipile dashboard'
          ]
        });
      }
      
      if (errorStatus === 403) {
        return res.status(403).json({
          success: false,
          message: 'Access denied by Unipile',
          details: 'Your API key does not have permission to perform this action.',
          error: errorTitle || 'Forbidden',
          troubleshooting: [
            'Check your Unipile account permissions',
            'Verify your API key has the required scopes',
            'Contact Unipile support if you believe this is an error'
          ]
        });
      }
      
      if (errorStatus === 404) {
        return res.status(404).json({
          success: false,
          message: 'Unipile endpoint not found',
          details: 'The requested Unipile API endpoint does not exist. This may indicate an outdated SDK or incorrect DSN.',
          error: errorTitle || 'Not found',
          troubleshooting: [
            'Verify your DSN is correct (should include https:// and port)',
            'Check if you need to update the Unipile SDK',
            'Contact support if the issue persists'
          ]
        });
      }
      
      if (errorStatus === 429) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          details: 'You have made too many requests to Unipile. Please wait before trying again.',
          error: errorTitle || 'Too many requests',
          troubleshooting: [
            'Wait a few minutes before trying again',
            'Check your Unipile plan limits',
            'Consider upgrading your Unipile plan if this happens frequently'
          ]
        });
      }
      
      if (errorStatus >= 500) {
        return res.status(502).json({
          success: false,
          message: 'Unipile service unavailable',
          details: 'Unipile\'s servers are experiencing issues. Please try again later.',
          error: errorTitle || 'Service error',
          troubleshooting: [
            'Wait a few minutes and try again',
            'Check Unipile\'s status page for service updates',
            'Contact Unipile support if the issue persists'
          ]
        });
      }
      
      // Generic error for other cases
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to Unipile',
        details: errorTitle || sdkError.message || 'An unexpected error occurred while connecting to Unipile',
        error: errorType || 'Unknown error',
        troubleshooting: [
          'Verify your Unipile credentials in Website Settings',
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if the problem continues'
        ]
      });
    }
  } catch (error) {
    console.error('connectSocialAccount error:', error);
    
    // Handle configuration errors
    if (error.message?.includes('not configured')) {
      return res.status(400).json({
        success: false,
        message: 'Unipile not configured',
        details: 'Please configure your Unipile credentials in Website Settings before connecting social accounts.',
        troubleshooting: [
          'Go to Website Settings',
          'Enter your Unipile DSN and Access Token',
          'Save the settings and try again'
        ]
      });
    }
    
    // Generic error
    return res.status(500).json({
      success: false,
      message: 'Failed to start social account connection',
      details: error.message || 'An unexpected error occurred',
      troubleshooting: [
        'Check your internet connection',
        'Verify your Unipile credentials are correct',
        'Try again in a few moments',
        'Contact support if the problem continues'
      ]
    });
  }
};

export const listSocialAccounts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching social accounts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch social accounts'
      });
    }

    if (!accounts || accounts.length === 0) {
      return res.status(200).json({
        success: true,
        accounts: []
      });
    }

    const accountIds = accounts.map((a) => a.id);

    const { data: mappings, error: mappingError } = await supabase
      .from('social_account_agents')
      .select('*')
      .in('social_account_id', accountIds);

    if (mappingError) {
      console.error('Error fetching social account mappings:', mappingError);
    }

    const mappingByAccountId = new Map();
    (mappings || []).forEach((m) => {
      mappingByAccountId.set(m.social_account_id, m);
    });

    const enriched = accounts.map((acc) => {
      const mapping = mappingByAccountId.get(acc.id);
      return {
        ...acc,
        agent_id: mapping ? mapping.agent_id : null,
        routing_rules: mapping ? mapping.routing_rules : null
      };
    });

    return res.status(200).json({
      success: true,
      accounts: enriched
    });
  } catch (error) {
    console.error('listSocialAccounts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch social accounts'
    });
  }
};

export const bindSocialAccountAgent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { agentId, routingRules = null } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required'
      });
    }

    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (accountError) {
      console.error('Error loading social account:', accountError);
      return res.status(500).json({
        success: false,
        message: 'Failed to load social account'
      });
    }

    if (!account || account.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const { error: upsertError } = await supabase
      .from('social_account_agents')
      .upsert(
        {
          social_account_id: id,
          agent_id: agentId,
          routing_rules: routingRules
        },
        { onConflict: 'social_account_id' }
      );

    if (upsertError) {
      console.error('Error binding social account agent:', upsertError);
      return res.status(500).json({
        success: false,
        message: 'Failed to bind agent to social account'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Agent mapped to social account successfully'
    });
  } catch (error) {
    console.error('bindSocialAccountAgent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bind agent to social account'
    });
  }
};

export const handleUnipileWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    console.log('📥 Unipile webhook event:', JSON.stringify(event, null, 2));

    // Handle hosted auth completion webhook
    // This comes when a user completes the hosted auth flow
    // Format: { status: 'CREATION_SUCCESS' | 'RECONNECTED', account_id: '...', name: 'userId' }
    if (event.status === 'CREATION_SUCCESS' || event.status === 'RECONNECTED') {
      const { account_id, name } = event;
      
      if (account_id && name) {
        // 'name' is the userId we passed when creating the hosted auth link
        const userId = name;
        
        // Try to get provider info from the account if available
        // Otherwise, we'll need to query Unipile API or store it differently
        const { error } = await supabase
          .from('social_accounts')
          .upsert(
            {
              user_id: userId,
              unipile_account_id: account_id,
              status: 'OK',
              display_name: event.name || null,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'unipile_account_id' }
          );

        if (error) {
          console.error('Error upserting social account from webhook:', error);
        } else {
          console.log(`✅ Social account created/updated: ${account_id} for user ${userId}`);
        }
      }
    }

    // Handle account status updates (different webhook format)
    if (event.type === 'account.status.updated') {
      const { accountId, status, displayName } = event.data || {};

      if (accountId) {
        const { error } = await supabase
          .from('social_accounts')
          .update({
            status: status || 'OK',
            display_name: displayName || null,
            updated_at: new Date().toISOString()
          })
          .eq('unipile_account_id', accountId);

        if (error) {
          console.error('Error updating social account status:', error);
        }
      }
    }

    // Handle incoming messages
    if (event.type === 'message.received') {
      const { accountId, message } = event.data || {};

      // TODO: Wire this into your agent pipeline.
      // For now we just log so nothing breaks.
      console.log('📨 Incoming social message from Unipile:', {
        accountId,
        from: message?.from,
        text: message?.text
      });
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('handleUnipileWebhook error:', error);
    return res.status(500).send('Server error');
  }
};




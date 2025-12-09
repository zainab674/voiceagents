import { supabase } from '#lib/supabase.js';
import { getUnipileClientForTenant } from '#lib/unipileClient.js';

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
        message: 'Invalid or missing provider'
      });
    }

    const client = await getUnipileClientForTenant(tenantSlug);

    // NOTE: The exact shape of this call may differ slightly depending on
    // Unipile SDK version. Adjust config as needed based on their docs.
    const hostedAuthResponse = await client.account.createHostedAuth({
      provider,
      // Pass metadata to help match the user on webhook callbacks if supported
      metadata: {
        appUserId: userId,
        tenant: tenantSlug
      },
      reconnectAccountId: reconnect ? existingAccountId : undefined
    });

    const hostedAuthUrl =
      hostedAuthResponse.hostedAuthUrl || hostedAuthResponse.url || null;
    const unipileAccountId = hostedAuthResponse.accountId || null;

    if (!hostedAuthUrl) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create hosted auth session with Unipile'
      });
    }

    // Create a draft record so we can track this account even before
    // status is updated via webhook.
    if (unipileAccountId) {
      const { error } = await supabase
        .from('social_accounts')
        .insert({
          user_id: userId,
          provider,
          unipile_account_id: unipileAccountId,
          status: 'PENDING'
        });

      if (error) {
        console.error('Error inserting social account draft:', error);
      }
    }

    return res.status(200).json({
      success: true,
      url: hostedAuthUrl
    });
  } catch (error) {
    console.error('connectSocialAccount error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start social account connection'
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

    if (!event || !event.type) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    console.log('📥 Unipile webhook event:', JSON.stringify(event, null, 2));

    if (event.type === 'account.status.updated') {
      const { accountId, status, displayName } = event.data || {};

      if (accountId) {
        const { error } = await supabase
          .from('social_accounts')
          .upsert(
            {
              unipile_account_id: accountId,
              status: status || 'OK',
              display_name: displayName || null
            },
            { onConflict: 'unipile_account_id' }
          );

        if (error) {
          console.error('Error updating social account status:', error);
        }
      }
    }

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




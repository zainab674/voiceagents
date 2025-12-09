import { UnipileClient } from 'unipile-node-sdk';
import { supabase } from '#lib/supabase.js';

/**
 * Resolve Unipile configuration for a given tenant/user.
 *
 * We read from the same website/tenant settings that admins can edit from the UI,
 * and fall back to environment variables if nothing is configured yet.
 */
async function getUnipileConfigForTenant(tenantSlugOrId = 'main') {
  // Try to resolve from users table via slug_name first
  const { data, error } = await supabase
    .from('users')
    .select('unipile_dsn, unipile_access_token')
    .eq('slug_name', tenantSlugOrId)
    .maybeSingle();

  if (!error && data && (data.unipile_dsn || data.unipile_access_token)) {
    return {
      dsn: data.unipile_dsn || null,
      accessToken: data.unipile_access_token || null
    };
  }

  // Fallback to env if admin hasn't configured anything yet
  const dsn = process.env.UNIPILE_DSN || null;
  const accessToken = process.env.UNIPILE_ACCESS_TOKEN || null;

  return { dsn, accessToken };
}

export async function getUnipileClientForTenant(tenantSlugOrId = 'main') {
  const { dsn, accessToken } = await getUnipileConfigForTenant(tenantSlugOrId);

  if (!dsn || !accessToken) {
    throw new Error('Unipile is not configured. Please set DSN and access token in Website Settings.');
  }

  return new UnipileClient(dsn, accessToken);
}




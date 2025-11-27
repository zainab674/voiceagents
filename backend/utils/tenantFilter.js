/**
 * Apply tenant filtering to Supabase queries
 * For whitelabel tenants, filter by exact tenant match
 * For main tenant, return all data (no filter)
 */
export function applyTenantFilter(query, tenant, userId = null) {
  // If no tenant or main tenant, return query as-is
  if (!tenant || tenant === 'main') {
    return query;
  }

  // For whitelabel tenants, filter by exact tenant match
  // This ensures data isolation between tenants
  return query.eq('tenant', tenant);
}

/**
 * Get tenant from request object
 * Checks req.tenant (set by tenantMiddleware) or req.user
 */
export function getTenantFromRequest(req) {
  // First check if tenant middleware set it
  if (req.tenant) {
    return req.tenant;
  }

  // Fallback to user's tenant if available
  if (req.user?.tenant) {
    return req.user.tenant;
  }

  // Default to main
  return 'main';
}



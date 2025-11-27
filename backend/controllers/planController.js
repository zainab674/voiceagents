import { supabase } from '#lib/supabase.js';

/**
 * Helper function to determine userTenant from user data
 * This ensures consistent tenant determination across create and fetch operations
 * @param {Object} userData - User data from database
 * @returns {string|null} - The tenant identifier or null for main tenant
 */
function determineUserTenant(userData) {
  if (!userData) {
    return null;
  }
  
  // For whitelabel admins, use their slug_name (they manage their own tenant's plans)
  // For whitelabel users, use their tenant (which is their admin's slug)
  // For main tenant users/admins, use null
  if (userData.slug_name && userData.slug_name !== 'main' && userData.slug_name.trim() !== '') {
    // Whitelabel admin: use their slug_name (trimmed for consistency)
    return userData.slug_name.trim();
  } else if (userData.tenant && userData.tenant !== 'main' && userData.tenant.trim() !== '') {
    // Whitelabel user: use their tenant (admin's slug) - trimmed for consistency
    return userData.tenant.trim();
  } else {
    // Main tenant user/admin
    return null;
  }
}

// Get all plan configurations for a tenant
export const getPlanConfigs = async (req, res) => {
  try {
    const tenant = req.tenant || 'main';
    const userId = req.user?.userId;

    console.log('📋 Fetching plan configs for tenant:', tenant);
    console.log('🔐 Auth check - req.user exists:', !!req.user, 'userId:', userId);

    // Get user's tenant info
    let userTenant = null;
    let userSlug = null;
    let userRole = null;
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('slug_name, tenant, role')
        .eq('id', userId)
        .single();

      if (userData) {
        userSlug = userData.slug_name;
        userRole = userData.role;
        console.log('👤 User data for plan fetch:', { 
          slug_name: userData.slug_name, 
          tenant: userData.tenant, 
          role: userData.role 
        });
        // Use helper function for consistent tenant determination
        userTenant = determineUserTenant(userData);
        if (userTenant) {
          console.log('✅ Determined userTenant:', userTenant);
        } else {
          console.log('ℹ️ Determined as main tenant (userTenant = null)');
          // If user has slug_name but determineUserTenant returned null, log warning
          if (userData.slug_name && userData.slug_name !== 'main') {
            console.warn('⚠️ WARNING: User has slug_name but userTenant is null!', {
              slug_name: userData.slug_name,
              tenant: userData.tenant,
              role: userData.role
            });
            // Fallback: use slug_name directly if it exists
            userTenant = userData.slug_name.trim();
            console.log('🔧 Using slug_name as fallback userTenant:', userTenant);
          }
        }
      } else {
        console.warn('⚠️ No user data found for userId:', userId);
      }
    } else {
      // If no user ID, use tenant from request (for public signup pages)
      userTenant = tenant !== 'main' ? tenant : null;
      console.log('ℹ️ No userId, using tenant from request:', userTenant);
    }
    
    console.log('🏷️ Final userTenant for fetching plans:', userTenant);

    // Fetch plans based on user context
    let plans = [];
    const isAuthenticated = !!userId;
    const isWhitelabelAdmin = isAuthenticated && userRole === 'admin' && userTenant && userTenant !== 'main' && userTenant.trim() !== '';

    if (userTenant && userTenant !== 'main' && userTenant.trim() !== '') {
      const trimmedTenant = userTenant.trim();
      console.log(`[Plan Config] Fetching plans for whitelabel tenant: "${trimmedTenant}" (authenticated: ${isAuthenticated}, isAdmin: ${isWhitelabelAdmin})`);
      
      // Debug: Check what plans exist in DB for this tenant
      const { data: debugPlans } = await supabase
        .from('plan_configs')
        .select('plan_key, tenant, name, is_active')
        .eq('tenant', trimmedTenant);
      console.log(`[Plan Config] DEBUG - All plans in DB with tenant="${trimmedTenant}":`, debugPlans);
      
      // For authenticated users (admins or regular users): ONLY show their tenant's plans (strict tenant isolation)
      // For public signup pages on whitelabel domains: ONLY show that whitelabel admin's plans (no main tenant fallback)
      // For public signup pages on main domain: show main tenant plans
      if (isAuthenticated) {
        // Authenticated users (admins or regular users) only see their own tenant's plans
        const { data: tenantPlans, error: tenantError } = await supabase
          .from('plan_configs')
          .select('*')
          .eq('is_active', true)
          .eq('tenant', trimmedTenant)
          .order('display_order', { ascending: true });

        if (tenantError) {
          console.error('❌ Error fetching tenant plans:', tenantError);
          console.error('❌ Query details:', { tenant: trimmedTenant, error: tenantError });
          return res.status(500).json({
            success: false,
            message: 'Error fetching plan configurations',
            error: tenantError.message
          });
        }

        plans = tenantPlans || [];
        console.log(`[Plan Config] Tenant plans found (authenticated user view): ${plans.length}`);
        console.log(`[Plan Config] Tenant plan keys:`, plans.map(p => ({ key: p.plan_key, tenant: p.tenant, name: p.name })));
      } else {
        // Public signup page on whitelabel domain: ONLY show that whitelabel admin's plans
        // This ensures users signing up on a whitelabel domain only see that admin's plans
        const { data: tenantPlans, error: tenantError } = await supabase
          .from('plan_configs')
          .select('*')
          .eq('is_active', true)
          .eq('tenant', trimmedTenant)
          .order('display_order', { ascending: true });

        if (tenantError) {
          console.error('❌ Error fetching tenant plans:', tenantError);
          console.error('❌ Query details:', { tenant: trimmedTenant, error: tenantError });
          return res.status(500).json({
            success: false,
            message: 'Error fetching plan configurations',
            error: tenantError.message
          });
        }

        plans = tenantPlans || [];
        console.log(`[Plan Config] Tenant plans found (public signup on whitelabel domain): ${plans.length}`);
        console.log(`[Plan Config] Tenant plan keys:`, plans.map(p => ({ key: p.plan_key, tenant: p.tenant, name: p.name })));
      }
      
      if (plans.length === 0 && trimmedTenant) {
        console.warn(`⚠️ No tenant plans found for tenant="${trimmedTenant}". Checking if plans exist with different case or format...`);
        // Try case-insensitive search
        const { data: caseCheck } = await supabase
          .from('plan_configs')
          .select('plan_key, tenant, name')
          .ilike('tenant', trimmedTenant);
        console.log(`[Plan Config] Case-insensitive check results:`, caseCheck);
      }
    } else {
      // For main tenant: only get main tenant plans (tenant IS NULL)
      const { data, error } = await supabase
        .from('plan_configs')
        .select('*')
        .eq('is_active', true)
        .is('tenant', null)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('❌ Error fetching plan configs:', error);
        return res.status(500).json({
          success: false,
          message: 'Error fetching plan configurations',
          error: error.message
        });
      }

      plans = data || [];
    }

    // Sort plans by display_order, then by price
    const sortedPlans = plans.sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return (a.display_order || 0) - (b.display_order || 0);
      }
      return (a.price || 0) - (b.price || 0);
    });

    console.log('✅ Plan configs fetched successfully:', sortedPlans.length);

    res.status(200).json({
      success: true,
      data: { plans: sortedPlans }
    });
  } catch (error) {
    console.error('❌ Get plan configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get single plan configuration
export const getPlanConfig = async (req, res) => {
  try {
    const { planKey } = req.params;
    const tenant = req.tenant || 'main';
    const userId = req.user?.userId;

    console.log('📋 Fetching plan config:', planKey, 'for tenant:', tenant);

    // Get user's tenant info
    let userTenant = null;
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('slug_name, tenant, role')
        .eq('id', userId)
        .single();

      if (userData) {
        // For whitelabel admins, use their slug_name (they manage their own tenant's plans)
        // For whitelabel users, use their tenant (which is their admin's slug)
        // For main tenant users/admins, use null
        if (userData.slug_name && userData.slug_name !== 'main') {
          // Whitelabel admin: use their slug_name
          userTenant = userData.slug_name;
        } else if (userData.tenant && userData.tenant !== 'main') {
          // Whitelabel user: use their tenant (admin's slug)
          userTenant = userData.tenant;
        } else {
          // Main tenant user/admin
          userTenant = null;
        }
      }
    } else {
      // If no user ID, use tenant from request (for public signup pages)
      userTenant = tenant !== 'main' ? tenant : null;
    }

    // Build query - prefer tenant-specific plan, fallback to main tenant plan
    let plan = null;
    
    if (userTenant && userTenant !== 'main') {
      // First try to get tenant-specific plan
      const { data: tenantPlan, error: tenantError } = await supabase
        .from('plan_configs')
        .select('*')
        .eq('plan_key', planKey)
        .eq('is_active', true)
        .eq('tenant', userTenant)
        .maybeSingle();
      
      if (tenantError && tenantError.code !== 'PGRST116') {
        console.error('❌ Error fetching tenant plan:', tenantError);
        return res.status(500).json({
          success: false,
          message: 'Error fetching plan configuration',
          error: tenantError.message
        });
      }
      
      if (tenantPlan) {
        plan = tenantPlan;
      } else {
        // Fallback to main tenant plan
        const { data: mainPlan, error: mainError } = await supabase
          .from('plan_configs')
          .select('*')
          .eq('plan_key', planKey)
          .eq('is_active', true)
          .is('tenant', null)
          .maybeSingle();
        
        if (mainError && mainError.code !== 'PGRST116') {
          console.error('❌ Error fetching main plan:', mainError);
          return res.status(500).json({
            success: false,
            message: 'Error fetching plan configuration',
            error: mainError.message
          });
        }
        
        plan = mainPlan;
      }
    } else {
      // Main tenant: only get main tenant plan
      const { data: mainPlan, error: mainError } = await supabase
        .from('plan_configs')
        .select('*')
        .eq('plan_key', planKey)
        .eq('is_active', true)
        .is('tenant', null)
        .maybeSingle();
      
      if (mainError && mainError.code !== 'PGRST116') {
        console.error('❌ Error fetching plan config:', mainError);
        return res.status(500).json({
          success: false,
          message: 'Error fetching plan configuration',
          error: mainError.message
        });
      }
      
      plan = mainPlan;
    }

    if (error) {
      console.error('❌ Error fetching plan config:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching plan configuration',
        error: error.message
      });
    }

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan configuration not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { plan }
    });
  } catch (error) {
    console.error('❌ Get plan config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create or update plan configuration
export const upsertPlanConfig = async (req, res) => {
  try {
    const { planKey, name, price, minutesLimit, features } = req.body;
    const tenant = req.tenant || 'main';
    const userId = req.user?.userId;

    if (!planKey || !name || price === undefined || minutesLimit === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planKey, name, price, minutesLimit'
      });
    }

    console.log('💾 Upserting plan config:', planKey, 'for tenant:', tenant);

    // Get user's tenant info
    let userTenant = null;
    let adminMinutes = 0;
    let userRole = null;
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('slug_name, tenant, role, minutes_limit')
        .eq('id', userId)
        .single();

      if (userData) {
        userRole = userData.role;
        console.log('👤 User data:', { 
          slug_name: userData.slug_name, 
          tenant: userData.tenant, 
          role: userData.role 
        });
        // Use helper function for consistent tenant determination
        userTenant = determineUserTenant(userData);
        if (userTenant) {
          adminMinutes = userData.minutes_limit || 0;
        }
      }
    }
    
    console.log('🏷️ Determined userTenant for plan creation:', userTenant);

    // Check if user is admin
    if (!userRole || userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // For whitelabel admins, validate minutes allocation
    if (userTenant && userTenant !== 'main' && userTenant.trim() !== '' && adminMinutes > 0) {
      // Get existing plans for this tenant (use trimmed value for consistency)
      const { data: existingPlans } = await supabase
        .from('plan_configs')
        .select('plan_key, minutes_limit')
        .eq('tenant', userTenant.trim())
        .neq('plan_key', planKey);

      const currentTotal = (existingPlans || []).reduce((sum, plan) => {
        const planMinutes = plan.minutes_limit || 0;
        return planMinutes > 0 ? sum + planMinutes : sum;
      }, 0);

      const newTotal = currentTotal + (minutesLimit > 0 ? minutesLimit : 0);

      if (newTotal > adminMinutes) {
        return res.status(400).json({
          success: false,
          message: `Cannot allocate ${minutesLimit} minutes. Available: ${adminMinutes - currentTotal} minutes. Total allocated cannot exceed your plan minutes.`
        });
      }

      // Prevent unlimited plans for limited admins
      if (minutesLimit === 0 && adminMinutes > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot set plan to unlimited minutes. You have a limited plan.'
        });
      }
    }

    // Check if plan exists
    // Main tenant admin can edit main tenant plans (tenant IS NULL)
    // Whitelabel admin can edit their tenant plans
    let existingQuery = supabase
      .from('plan_configs')
      .select('id, tenant')
      .eq('plan_key', planKey);

    if (userTenant && userTenant !== 'main' && userTenant.trim() !== '') {
      // Whitelabel admin: check for their tenant-specific plan
      existingQuery = existingQuery.eq('tenant', userTenant.trim());
    } else {
      // Main tenant admin: check for main tenant plan (tenant IS NULL)
      existingQuery = existingQuery.is('tenant', null);
    }

    const { data: existingPlan } = await existingQuery.maybeSingle();

    const planData = {
      plan_key: planKey,
      name,
      price: parseFloat(price),
      minutes_limit: parseInt(minutesLimit),
      features: features || [],
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      display_order: req.body.display_order !== undefined ? parseInt(req.body.display_order) : 0,
      // Set tenant: null for main tenant admin, userTenant for whitelabel admin
      // Ensure tenant is a valid non-empty string
      tenant: (userTenant && userTenant !== 'main' && userTenant.trim() !== '') 
        ? userTenant.trim() 
        : null
    };

    console.log('💾 Plan data to save:', { 
      plan_key: planData.plan_key, 
      tenant: planData.tenant, 
      is_active: planData.is_active 
    });

    let result;
    if (existingPlan) {
      // Update existing plan
      console.log('🔄 Updating existing plan:', existingPlan.id);
      const { data, error } = await supabase
        .from('plan_configs')
        .update(planData)
        .eq('id', existingPlan.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating plan:', error);
        throw error;
      }
      result = data;
    } else {
      // Create new plan
      console.log('➕ Creating new plan with tenant:', planData.tenant);
      const { data, error } = await supabase
        .from('plan_configs')
        .insert(planData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating plan:', error);
        throw error;
      }
      result = data;
    }

    console.log('✅ Plan config upserted successfully:', { 
      id: result.id, 
      plan_key: result.plan_key, 
      tenant: result.tenant 
    });

    res.status(200).json({
      success: true,
      data: { plan: result },
      message: existingPlan ? 'Plan updated successfully' : 'Plan created successfully'
    });
  } catch (error) {
    console.error('❌ Upsert plan config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Check available minutes for a whitelabel tenant
export const checkAvailableMinutes = async (req, res) => {
  try {
    const tenant = req.tenant || 'main';
    
    // If main tenant, return null (unlimited)
    if (tenant === 'main') {
      return res.status(200).json({
        success: true,
        data: {
          available: null,
          totalLimit: null,
          allocated: 0
        }
      });
    }

    // Get whitelabel admin for this tenant
    const { data: adminData } = await supabase
      .from('users')
      .select('id, minutes_limit, slug_name')
      .eq('slug_name', tenant)
      .eq('is_whitelabel', true)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminData) {
      return res.status(404).json({
        success: false,
        message: 'Whitelabel admin not found for this tenant'
      });
    }

    const adminMinutes = adminData.minutes_limit || 0;
    
    // If admin has unlimited minutes (0), return null
    if (adminMinutes === 0) {
      return res.status(200).json({
        success: true,
        data: {
          available: null,
          totalLimit: null,
          allocated: 0
        }
      });
    }

    // Calculate allocated minutes: sum of all users' minutes_limit in this tenant (excluding the admin)
    const { data: tenantUsers } = await supabase
      .from('users')
      .select('minutes_limit')
      .eq('tenant', tenant)
      .neq('id', adminData.id); // Exclude the admin

    const allocated = (tenantUsers || []).reduce((sum, user) => {
      const userMinutes = user.minutes_limit || 0;
      return userMinutes > 0 ? sum + userMinutes : sum;
    }, 0);

    const available = adminMinutes - allocated;

    return res.status(200).json({
      success: true,
      data: {
        available: available,
        totalLimit: adminMinutes,
        allocated: allocated
      }
    });
  } catch (error) {
    console.error('❌ Check available minutes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete plan configuration
export const deletePlanConfig = async (req, res) => {
  try {
    const { planKey } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user's tenant info
    const { data: userData } = await supabase
      .from('users')
      .select('slug_name, tenant, role')
      .eq('id', userId)
      .single();

    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Use helper function for consistent tenant determination
    const userTenant = determineUserTenant(userData);
    console.log('🗑️ Delete plan - userTenant:', userTenant);

    // Build delete query based on admin type
    let deleteQuery = supabase
      .from('plan_configs')
      .delete()
      .eq('plan_key', planKey);

    if (userTenant && userTenant !== 'main' && userTenant.trim() !== '') {
      // Whitelabel admin can only delete their own tenant plans
      const trimmedTenant = userTenant.trim();
      deleteQuery = deleteQuery.eq('tenant', trimmedTenant);
      console.log('🗑️ Deleting plan for whitelabel tenant:', trimmedTenant);
    } else {
      // Main tenant admin can delete main tenant plans (tenant IS NULL)
      deleteQuery = deleteQuery.is('tenant', null);
      console.log('🗑️ Deleting plan for main tenant');
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('❌ Error deleting plan config:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting plan configuration',
        error: error.message
      });
    }

    console.log('✅ Plan config deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Plan configuration deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete plan config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


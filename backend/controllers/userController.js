import { supabase } from '#lib/supabase.js';
import bcrypt from 'bcrypt';
import { validateSlug } from '#utils/whitelabel.js';

// Get all users with pagination and filtering
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user?.userId;

    console.log('📋 Fetching users with filters:', { page, limit, role, status, search });

    // Get current user's tenant info for filtering
    let userTenant = null;
    let userRole = null;
    let userSlug = null;
    
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('slug_name, tenant, role')
        .eq('id', userId)
        .single();

      if (userData) {
        userRole = userData.role;
        userSlug = userData.slug_name;
        userTenant = userData.tenant || 'main';
      }
    }

    // Determine admin type
    const isMainTenantAdmin = userRole === 'admin' && (!userSlug || userTenant === 'main');
    const isWhitelabelAdmin = userRole === 'admin' && userSlug && userTenant !== 'main';

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply tenant-based filtering
    if (isWhitelabelAdmin) {
      // Whitelabel admin: only see users from their tenant (where tenant = their slug_name)
      query = query.eq('tenant', userSlug);
    } else if (isMainTenantAdmin) {
      // Main tenant admin: see main tenant users (tenant = 'main') AND whitelabel admins (slug_name IS NOT NULL)
      // But NOT whitelabel customers (tenant != 'main' AND slug_name IS NULL)
      // We'll filter in JavaScript after fetching
    }
    // Regular users see no users (this endpoint should be admin-only anyway)

    // Apply filters
    if (role && role !== 'All Roles') {
      query = query.eq('role', role);
    }

    if (status && status !== 'All Status') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Note: We'll get count after filtering for main tenant admin

    // Get all results first (before pagination) for main tenant admin filtering
    const { data: allUsers, error } = await query;

    if (error) {
      console.error('❌ Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }

    // Apply main tenant admin filtering in JavaScript
    let filteredUsers = allUsers || [];
    if (isMainTenantAdmin) {
      // Main tenant admin sees:
      // - Main tenant users (tenant = 'main')
      // - Whitelabel admins (slug_name IS NOT NULL)
      // But NOT whitelabel customers (tenant != 'main' AND slug_name IS NULL)
      filteredUsers = filteredUsers.filter(user => {
        const isMainTenant = user.tenant === 'main';
        const isWhitelabelAdminUser = user.slug_name !== null && user.slug_name !== undefined;
        // Include main tenant users OR whitelabel admins, exclude whitelabel customers
        return isMainTenant || isWhitelabelAdminUser;
      });
    }

    // Apply pagination after filtering
    const totalCount = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(offset, offset + parseInt(limit));

    // Format user data for frontend
    const formattedUsers = paginatedUsers.map(user => ({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role || 'user',
      status: user.status || 'Active',
      lastLogin: user.last_login ? formatLastLogin(user.last_login) : 'Never',
      createdAt: user.created_at,
      loginCount: user.login_count || 0,
      tenant: user.tenant,
      slug_name: user.slug_name,
      is_whitelabel: user.is_whitelabel
    }));

    console.log('✅ Users fetched successfully:', formattedUsers.length);

    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('👤 Fetching user by ID:', id);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching user:', error);
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: error.message
      });
    }

    const formattedUser = {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role || 'user',
      status: user.status || 'Active',
      lastLogin: user.last_login ? formatLastLogin(user.last_login) : 'Never',
      createdAt: user.created_at,
      loginCount: user.login_count || 0,
      phone: user.phone
    };

    console.log('✅ User fetched successfully');

    res.status(200).json({
      success: true,
      data: { user: formattedUser }
    });

  } catch (error) {
    console.error('❌ Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Create new user
export const createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'user' } = req.body;

    console.log('📝 Creating new user:', { email, firstName, lastName, role });

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, firstName, and lastName'
      });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing user:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Error checking user existence',
        error: checkError.message
      });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in Supabase auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        phone,
        role
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      return res.status(500).json({
        success: false,
        message: 'Error creating user account',
        error: authError.message
      });
    }

    // Insert user data into users table
    const { data: userData, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role,
          status: 'Active',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Error creating user profile',
        error: insertError.message
      });
    }

    console.log('✅ User created successfully:', userData.id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`,
          email: userData.email,
          role: userData.role,
          status: userData.status,
          lastLogin: 'Never',
          createdAt: userData.created_at,
          loginCount: 0
        }
      },
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, role, status } = req.body;

    console.log('✏️ Updating user:', id, { firstName, lastName, phone, role, status });

    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    const { data: userData, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Update error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating user',
        error: error.message
      });
    }

    console.log('✅ User updated successfully');

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`,
          email: userData.email,
          role: userData.role,
          status: userData.status,
          lastLogin: userData.last_login ? formatLastLogin(userData.last_login) : 'Never',
          createdAt: userData.created_at,
          loginCount: userData.login_count || 0
        }
      },
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting user:', id);

    // Delete from auth.users first
    const { error: authError } = await supabase.auth.admin.deleteUser(id);

    if (authError) {
      console.error('❌ Auth delete error:', authError);
      return res.status(500).json({
        success: false,
        message: 'Error deleting user account',
        error: authError.message
      });
    }

    // Delete from users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Error deleting user profile',
        error: deleteError.message
      });
    }

    console.log('✅ User deleted successfully');

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user?.userId;
    console.log('📊 Fetching user statistics');

    // Get current user's tenant info for filtering
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
        userRole = userData.role;
        userSlug = userData.slug_name;
        userTenant = userData.tenant || 'main';
      }
    }

    // Determine admin type
    const isMainTenantAdmin = userRole === 'admin' && (!userSlug || userTenant === 'main');
    const isWhitelabelAdmin = userRole === 'admin' && userSlug && userTenant !== 'main';

    // Helper function to build query with tenant filtering
    const buildQuery = () => {
      let query = supabase.from('users');
      if (isWhitelabelAdmin) {
        // Whitelabel admin: only count users from their tenant (where tenant = their slug_name)
        query = query.eq('tenant', userSlug);
        console.log(`📊 Filtering stats for whitelabel admin tenant: ${userSlug}`);
      }
      return query;
    };

    // For main tenant admin, we need to fetch all and filter in JavaScript
    // For whitelabel admin, we can use direct queries
    let finalTotalUsers = 0;
    let finalActiveUsers = 0;
    let finalRecentLogins = 0;
    let roleCounts = {};

    if (isMainTenantAdmin) {
      // Main tenant admin: fetch all users and filter
      const { data: allUsers, error: fetchError } = await supabase
        .from('users')
        .select('id, status, last_login, tenant, slug_name, role');
      
      if (fetchError) {
        console.error('❌ Error fetching users for stats:', fetchError);
        return res.status(500).json({
          success: false,
          message: 'Error fetching user statistics',
          error: fetchError.message
        });
      }

      // Filter: main tenant users (tenant = 'main') OR whitelabel admins (slug_name IS NOT NULL)
      const filteredUsers = (allUsers || []).filter(user => {
        const isMainTenant = user.tenant === 'main';
        const isWhitelabelAdminUser = user.slug_name !== null && user.slug_name !== undefined;
        return isMainTenant || isWhitelabelAdminUser;
      });

      finalTotalUsers = filteredUsers.length;
      finalActiveUsers = filteredUsers.filter(u => u.status === 'Active').length;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      finalRecentLogins = filteredUsers.filter(u => {
        if (!u.last_login) return false;
        return new Date(u.last_login) >= yesterday;
      }).length;

      // Calculate role counts
      roleCounts = filteredUsers
        .filter(u => u.role)
        .reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {});
    } else if (isWhitelabelAdmin) {
      // Whitelabel admin: use filtered queries
      // Get total users count
      const { count: totalUsers, error: totalError } = await buildQuery()
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('❌ Error counting total users:', totalError);
        return res.status(500).json({
          success: false,
          message: 'Error fetching user statistics',
          error: totalError.message
        });
      }

      // Get active users count
      const { count: activeUsers, error: activeError } = await buildQuery()
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');

      if (activeError) {
        console.error('❌ Error counting active users:', activeError);
      }

      // Get users by role
      const { data: roleStats, error: roleError } = await buildQuery()
        .select('role')
        .not('role', 'is', null);

      if (roleError) {
        console.error('❌ Error fetching role stats:', roleError);
      }

      roleCounts = (roleStats || []).reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      // Get recent logins (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: recentLogins, error: recentError } = await buildQuery()
        .select('*', { count: 'exact', head: true })
        .gte('last_login', yesterday.toISOString());

      if (recentError) {
        console.error('❌ Error counting recent logins:', recentError);
      }

      finalTotalUsers = totalUsers || 0;
      finalActiveUsers = activeUsers || 0;
      finalRecentLogins = recentLogins || 0;
    } else {
      // Regular user or no filtering - return empty stats
      finalTotalUsers = 0;
      finalActiveUsers = 0;
      finalRecentLogins = 0;
      roleCounts = {};
    }

    console.log('✅ User statistics fetched successfully');

    res.status(200).json({
      success: true,
      data: {
        totalUsers: finalTotalUsers,
        activeUsers: finalActiveUsers,
        inactiveUsers: finalTotalUsers - finalActiveUsers,
        roleCounts,
        recentLogins: finalRecentLogins
      }
    });

  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const completeSignup = async (req, res) => {
  try {
    const { user_id: userId, slug, whitelabel } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, slug_name, tenant, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('❌ Error fetching user during complete-signup:', userError);
      return res.status(500).json({
        success: false,
        message: 'Failed to load user'
      });
    }

    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updates = { updated_at: new Date().toISOString() };
    let assignedSlug = userRecord.slug_name || null;
    let tenant = userRecord.tenant || 'main';

    if (whitelabel && slug) {
      const validation = validateSlug(slug);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      const normalizedSlug = validation.slug;

      const { data: existingSlug, error: slugError } = await supabase
        .from('users')
        .select('id')
        .eq('slug_name', normalizedSlug)
        .maybeSingle();

      if (slugError && slugError.code !== 'PGRST116') {
        console.error('❌ Error validating slug uniqueness:', slugError);
        return res.status(500).json({
          success: false,
          message: 'Failed to validate slug'
        });
      }

      if (existingSlug && existingSlug.id !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Slug is already taken'
        });
      }

      assignedSlug = normalizedSlug;
      tenant = normalizedSlug;

      updates.slug_name = normalizedSlug;
      updates.tenant = normalizedSlug;
      updates.role = 'admin';
      updates.is_whitelabel = true;
      updates.minutes_used = 0;

      if (process.env.DEFAULT_TENANT_MINUTES_LIMIT) {
        const parsed = parseInt(process.env.DEFAULT_TENANT_MINUTES_LIMIT, 10);
        if (!Number.isNaN(parsed)) {
          updates.minutes_limit = parsed;
        }
      }
    } else {
      updates.tenant = tenant || 'main';
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating user during complete-signup:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to finalize signup'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Signup completed successfully',
      tenant,
      slug: assignedSlug
    });

  } catch (error) {
    console.error('❌ completeSignup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get comprehensive user details (assistants, calls, campaigns, stats)
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.userId;

    console.log('📊 Fetching comprehensive details for user:', id);

    // Get user basic info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: userError.message
      });
    }

    // Get user's agents/assistants
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (agentsError) {
      console.error('❌ Error fetching agents:', agentsError);
    }

    // Get user's calls
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        *,
        agents(name)
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10); // Get recent 10 calls

    if (callsError) {
      console.error('❌ Error fetching calls:', callsError);
    }

    // Get user's campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        *,
        agents(name)
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
    }

    // Calculate statistics
    const totalCalls = calls?.length || 0;
    const successfulCalls = calls?.filter(call => call.success).length || 0;
    const totalDuration = calls?.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) || 0;
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

    // Format duration
    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:00` : `${minutes}:00`;
    };

    // Format calls data
    const formattedCalls = (calls || []).map(call => ({
      id: call.id,
      type: call.call_type || 'Unknown',
      duration: formatDuration(call.duration_seconds || 0),
      date: new Date(call.created_at).toLocaleDateString(),
      status: call.success ? 'Completed' : 'Failed',
      agent: call.agents?.name || 'Unknown'
    }));

    // Format campaigns data
    const formattedCampaigns = (campaigns || []).map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.execution_status || 'Unknown',
      contacts: campaign.total_contacts || 0,
      calls: campaign.total_calls || 0,
      agent: campaign.agents?.name || 'Unknown'
    }));

    // Format agents data
    const formattedAgents = (agents || []).map(agent => ({
      id: agent.id,
      name: agent.name,
      status: 'Active', // Default status
      calls: calls?.filter(call => call.agent_id === agent.id).length || 0
    }));

    const minutesLimit = typeof user.minutes_limit === 'number' ? user.minutes_limit : 0;
    const minutesUsed = typeof user.minutes_used === 'number' ? user.minutes_used : 0;
    const minutesRemaining = minutesLimit === 0 ? null : Math.max(minutesLimit - minutesUsed, 0);

    const stats = {
      totalCalls,
      totalDuration: formatDuration(totalDuration),
      avgCallDuration: formatDuration(avgDuration),
      successRate: `${successRate}%`,
      lastActivity: user.last_login ? formatLastLogin(user.last_login) : 'Never',
      minutesLimit,
      minutesUsed,
      minutesRemaining
    };

    console.log('✅ User details fetched successfully');

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          phone: user.phone,
          role: user.role || 'user',
          status: user.status || 'Active',
          createdAt: user.created_at
        },
        assistants: formattedAgents,
        calls: formattedCalls,
        campaigns: formattedCampaigns,
        stats
      }
    });

  } catch (error) {
    console.error('❌ Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Helper function to format last login time
function formatLastLogin(lastLogin) {
  const now = new Date();
  const loginTime = new Date(lastLogin);
  const diffMs = now - loginTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return loginTime.toLocaleDateString();
}

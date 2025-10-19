import { supabase } from '#lib/supabase.js';
import bcrypt from 'bcrypt';

// Get all users with pagination and filtering
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    const offset = (page - 1) * limit;

    console.log('📋 Fetching users with filters:', { page, limit, role, status, search });

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

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

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting users:', countError);
      return res.status(500).json({
        success: false,
        message: 'Error counting users',
        error: countError.message
      });
    }

    // Get paginated results
    const { data: users, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }

    // Format user data for frontend
    const formattedUsers = (users || []).map(user => ({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role || 'user',
      status: user.status || 'Active',
      lastLogin: user.last_login ? formatLastLogin(user.last_login) : 'Never',
      createdAt: user.created_at,
      loginCount: user.login_count || 0
    }));

    console.log('✅ Users fetched successfully:', formattedUsers.length);

    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
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
    console.log('📊 Fetching user statistics');

    // Get total users count
    const { count: totalUsers, error: totalError } = await supabase
      .from('users')
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
    const { count: activeUsers, error: activeError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active');

    if (activeError) {
      console.error('❌ Error counting active users:', activeError);
    }

    // Get users by role
    const { data: roleStats, error: roleError } = await supabase
      .from('users')
      .select('role')
      .not('role', 'is', null);

    if (roleError) {
      console.error('❌ Error fetching role stats:', roleError);
    }

    const roleCounts = (roleStats || []).reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // Get recent logins (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { count: recentLogins, error: recentError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_login', yesterday.toISOString());

    if (recentError) {
      console.error('❌ Error counting recent logins:', recentError);
    }

    console.log('✅ User statistics fetched successfully');

    res.status(200).json({
      success: true,
      data: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        inactiveUsers: (totalUsers || 0) - (activeUsers || 0),
        roleCounts,
        recentLogins: recentLogins || 0
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

    const stats = {
      totalCalls,
      totalDuration: formatDuration(totalDuration),
      avgCallDuration: formatDuration(avgDuration),
      successRate: `${successRate}%`,
      lastActivity: user.last_login ? formatLastLogin(user.last_login) : 'Never'
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

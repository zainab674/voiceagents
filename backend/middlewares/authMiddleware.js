import { supabase } from '#lib/supabase.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Auth middleware - authHeader:', authHeader ? 'Present' : 'Missing');
    console.log('Auth middleware - token length:', token ? token.length : 0);

    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify the token with Supabase
    console.log('Auth middleware - Verifying token with Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.log('Auth middleware - Supabase error:', error.message);
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
        error: error.message
      });
    }

    if (!user) {
      console.log('Auth middleware - No user found in token');
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('id, role, status, slug_name, tenant, is_whitelabel, minutes_limit')
      .eq('id', user.id)
      .single();

    if (userProfileError && userProfileError.code !== 'PGRST116') {
      console.error('Auth middleware - Failed to load user profile:', userProfileError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to load user profile',
        error: userProfileError.message
      });
    }

    if (userProfile && userProfile.status && userProfile.status !== 'Active') {
      console.log('Auth middleware - User not active:', userProfile.status);
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact support.'
      });
    }

    const role = userProfile?.role || user?.user_metadata?.role || 'user';
    const tenant = userProfile?.tenant || user?.user_metadata?.tenant || 'main';
    const slugName = userProfile?.slug_name || user?.user_metadata?.slug || null;
    const isWhitelabel = userProfile?.is_whitelabel || user?.user_metadata?.whitelabel || false;
    const minutesLimit = userProfile?.minutes_limit ?? null;

    console.log('Auth middleware - User authenticated:', user.id, 'role:', role);
    req.user = {
      userId: user.id,
      email: user.email,
      role,
      status: userProfile?.status || 'Active',
      tenant,
      slugName,
      isWhitelabel,
      minutesLimit
    };
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('id, role, status, slug_name, tenant, is_whitelabel, minutes_limit')
          .eq('id', user.id)
          .single();

        req.user = {
          userId: user.id,
          email: user.email,
          role: userProfile?.role || user?.user_metadata?.role || 'user',
          status: userProfile?.status || 'Active',
          tenant: userProfile?.tenant || user?.user_metadata?.tenant || 'main',
          slugName: userProfile?.slug_name || user?.user_metadata?.slug || null,
          isWhitelabel: userProfile?.is_whitelabel || user?.user_metadata?.whitelabel || false,
          minutesLimit: userProfile?.minutes_limit ?? null
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};
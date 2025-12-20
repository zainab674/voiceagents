import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateSlug } from '#utils/whitelabel.js';
import { initializePlansForTenant } from '#utils/planInitializer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      whitelabel = false,
      slug,
      tenant: requestedTenant,
      planKey,
      industry
    } = req.body;

    const tenant = slug || requestedTenant || 'main';

    // Calculate return URL for verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const frontendHost = frontendUrl.replace(/^https?:\/\//, '');
    const mainDomain = process.env.MAIN_DOMAIN || 'aiassistant.net';

    // Ensure we include the port if it's localhost and present in FRONTEND_URL
    const effectiveMainDomain = (mainDomain === 'localhost' && frontendHost.includes(':'))
      ? frontendHost
      : mainDomain;

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUrl = (tenant === 'main' || tenant === 'localhost')
      ? `${protocol}://${effectiveMainDomain}/auth?verified=true`
      : `${protocol}://${tenant}.${effectiveMainDomain}/auth?verified=true`;

    console.log('📝 Registration attempt for:', { email, firstName, lastName, hasPassword: !!password, tenant, redirectUrl });

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, firstName, and lastName'
      });
    }

    let normalizedSlug = null;
    if (whitelabel) {
      if (!slug) {
        return res.status(400).json({
          success: false,
          message: 'Slug is required for white label accounts'
        });
      }

      const validation = validateSlug(slug);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      normalizedSlug = validation.slug;

      const { data: existingSlug } = await supabase
        .from('users')
        .select('id')
        .eq('slug_name', normalizedSlug)
        .maybeSingle();

      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: 'Slug is already taken'
        });
      }
    }

    // Validate plan selection for whitelabel tenants
    let selectedPlanMinutes = 0;

    // CASE 1: New Whitelabel Admin Signup (whitelabel = true)
    if (whitelabel && planKey) {
      const { data: planConfig } = await supabase
        .from('plan_configs')
        .select('minutes_limit')
        .eq('plan_key', planKey)
        .is('tenant', null)
        .maybeSingle();

      if (!planConfig) {
        return res.status(400).json({
          success: false,
          message: 'Selected plan not found (System Plan)'
        });
      }
      selectedPlanMinutes = planConfig.minutes_limit || 0;
    }
    // CASE 2: User Signup under a Whitelabel Tenant (whitelabel = false, tenant != 'main')
    else if (planKey && tenant !== 'main') {
      const { data: planConfig } = await supabase
        .from('plan_configs')
        .select('minutes_limit')
        .eq('plan_key', planKey)
        .eq('tenant', tenant)
        .maybeSingle();

      if (!planConfig) {
        return res.status(400).json({
          success: false,
          message: 'Selected plan not found for this tenant'
        });
      }

      selectedPlanMinutes = planConfig.minutes_limit || 0;

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

      if (adminMinutes > 0) {
        if (selectedPlanMinutes === 0) {
          return res.status(400).json({
            success: false,
            message: 'This plan is not available. Please contact your administrator.'
          });
        }

        const { data: tenantUsers } = await supabase
          .from('users')
          .select('minutes_limit')
          .eq('tenant', tenant)
          .neq('id', adminData.id);

        const allocated = (tenantUsers || []).reduce((sum, user) => {
          const userMinutes = user.minutes_limit || 0;
          return userMinutes > 0 ? sum + userMinutes : sum;
        }, 0);

        const available = adminMinutes - allocated;

        if (selectedPlanMinutes > available) {
          return res.status(400).json({
            success: false,
            message: 'Your administrator does not have enough minutes available for this plan.'
          });
        }
      }
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in Supabase auth
    console.log('👤 Registering user in Supabase auth...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          firstName,
          lastName,
          phone
        }
      }
    });

    if (authError) {
      return res.status(500).json({
        success: false,
        error: authError.message
      });
    }

    if (!authData.user) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    console.log('✅ User created in Supabase auth:', authData.user.id);

    // Insert user data into users table
    const userRecord = {
      id: authData.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      role: whitelabel ? 'admin' : 'user',
      status: 'Active',
      tenant,
      slug_name: normalizedSlug,
      is_whitelabel: !!whitelabel,
      minutes_used: 0,
      minutes_limit: whitelabel
        ? parseInt(process.env.DEFAULT_TENANT_MINUTES_LIMIT || '0', 10) || 0
        : (planKey && selectedPlanMinutes > 0 ? selectedPlanMinutes : 0),
      landing_category: whitelabel ? industry || null : null,
      created_at: new Date().toISOString()
    };

    const { data: userData, error: insertError } = await supabase
      .from('users')
      .insert([userRecord])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      try { await supabase.auth.admin.deleteUser(authData.user.id); } catch (e) { }
      return res.status(500).json({ success: false, error: insertError.message });
    }

    console.log('✅ User data inserted successfully:', userData.id);

    // Initialize default plans for whitelabel admins
    if (whitelabel && normalizedSlug) {
      try {
        console.log(`🌱 Initializing default plans for whitelabel admin: ${normalizedSlug}`);
        const planResult = await initializePlansForTenant(normalizedSlug);
        if (planResult.success) {
          console.log(`✅ Plans initialized: ${planResult.created} created`);
        }
      } catch (planError) {
        console.error('❌ Error initializing plans (non-fatal):', planError);
      }

      // Setup Nginx reverse proxy for the whitelabel domain
      try {
        const fullDomain = `${normalizedSlug}.${mainDomain}`;
        const frontendPort = process.env.FRONTEND_PORT || '8080';
        const scriptPath = path.join(__dirname, '..', 'scripts', 'setup_reverse_proxy.sh');

        if (fs.existsSync(scriptPath)) {
          console.log(`🚀 Setting up Nginx reverse proxy for ${fullDomain} on port ${frontendPort}`);
          // Execute script asynchronously (don't block signup response)
          const script = spawn('sudo', [
            'bash',
            scriptPath,
            fullDomain,
            frontendPort
          ]);

          let output = '';
          script.stdout.on('data', (data) => {
            output += data.toString();
            console.log(`[Nginx Setup ${fullDomain}]:`, data.toString().trim());
          });

          script.stderr.on('data', (data) => {
            output += data.toString();
            console.error(`[Nginx Setup Error ${fullDomain}]:`, data.toString().trim());
          });

          script.on('close', (code) => {
            console.log(`✅ Nginx setup for ${fullDomain} closed with code ${code}`);
          });

          script.on('error', (err) => {
            console.error(`❌ Nginx script execution error: ${err.message}`);
          });
        }
      } catch (error) {
        console.error('Error setting up Nginx reverse proxy:', error);
      }
    }

    console.log('🎉 User registration completed successfully. Verification email sent.');

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          phone: userData.phone,
          role: userData.role,
          status: userData.status
        },
        verificationUrl: null // Removed manual generation as it invalidates the email link
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Authenticate user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.log('❌ Login failed:', authError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: authError.message
      });
    }

    console.log('✅ User authenticated successfully');

    // Get user profile from users table
    const { data: userData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Error fetching user profile',
        error: profileError.message
      });
    }

    console.log('🎉 Login completed successfully');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          phone: userData.phone,
          role: userData.role,
          status: userData.status
        },
        token: authData.session.access_token
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const { userId } = req.user;

    console.log('👤 Fetching user profile for:', userId);

    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching user:', error);
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: error.message
      });
    }

    console.log('✅ User profile fetched successfully');

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          phone: userData.phone,
          role: userData.role,
          status: userData.status,
          tenant: userData.tenant,
          slugName: userData.slug_name,
          isWhitelabel: userData.is_whitelabel,
          minutesLimit: userData.minutes_limit,
          createdAt: userData.created_at
        }
      }
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    console.log('👋 User logout requested');
    // In a JWT-based system, logout is handled client-side by removing the token
    // But we can invalidate the token if needed
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const tenant = req.tenant || 'main';

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const frontendHost = frontendUrl.replace(/^https?:\/\//, '');
    const mainDomain = process.env.MAIN_DOMAIN || 'aiassistant.net';

    // Ensure we include the port if it's localhost and present in FRONTEND_URL
    const effectiveMainDomain = (mainDomain === 'localhost' && frontendHost.includes(':'))
      ? frontendHost
      : mainDomain;

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUrl = (tenant === 'main' || tenant === 'localhost')
      ? `${protocol}://${effectiveMainDomain}/auth?reset=true`
      : `${protocol}://${tenant}.${effectiveMainDomain}/auth?reset=true`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user.userId, { password });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

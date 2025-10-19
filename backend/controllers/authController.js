import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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
    const { email, password, firstName, lastName, phone } = req.body;

    console.log('📝 Registration attempt for:', { email, firstName, lastName, hasPassword: !!password });

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, firstName, and lastName'
      });
    }

    // Check if user already exists
    console.log('🔍 Checking if user exists...');
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking existing user:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Error checking user existence',
        error: checkError.message
      });
    }

    if (existingUser) {
      console.log('⚠️ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    console.log('✅ User does not exist, proceeding with creation...');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('🔐 Password hashed successfully');

    // Create user in Supabase auth
    console.log('👤 Creating user in Supabase auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        phone
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

    console.log('✅ User created in Supabase auth:', authData.user.id);

    // Insert user data into users table
    console.log('💾 Inserting user data into database...');
    const { data: userData, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role: 'user', // Default role for new users
          status: 'Active',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError);
      console.error('❌ Insert error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });

      // Clean up auth user if insert fails
      console.log('🧹 Cleaning up auth user due to insert failure...');
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
        console.log('✅ Auth user cleaned up successfully');
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup auth user:', cleanupError);
      }

      return res.status(500).json({
        success: false,
        message: 'Error creating user profile',
        error: insertError.message,
        details: insertError.details || 'No additional details available'
      });
    }

    console.log('✅ User data inserted successfully:', userData.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: authData.user.id, email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    console.log('🎉 User registration completed successfully');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
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
        token
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
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

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log('Auth middleware - User authenticated:', user.id);
    req.user = { userId: user.id, email: user.email };
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
        req.user = { userId: user.id, email: user.email };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
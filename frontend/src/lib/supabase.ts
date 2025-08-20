import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://swsbfyushpefztsjootc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3c2JmeXVzaHBlZnp0c2pvb3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3ODMzOTYsImV4cCI6MjA2NzM1OTM5Nn0.Xx38dAg2CU-kxyOeyhqn-gRJgCE-naiphN_rkIAMuko';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for user data
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    };
    token: string;
  };
  error?: string;
}

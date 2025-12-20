import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { API_BASE_URL, AUTH_ENDPOINT } from "@/constants/URLConstant";
import { extractTenantFromHostname } from '../lib/tenant-utils';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'admin' | 'user';
  status: 'Active' | 'Inactive' | 'Suspended';
  tenant?: string;
  slugName?: string;
  isWhitelabel?: boolean;
  minutesLimit?: number | null;
}

interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  whitelabel?: boolean;
  slug?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (password: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Get user profile from our backend
          const token = session.access_token;
          const tenant = extractTenantFromHostname();
          const response = await fetch(`${AUTH_ENDPOINT}/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Tenant': tenant
            }
          });

          if (response.ok) {
            const { data } = await response.json();
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const token = session.access_token;
            const tenant = extractTenantFromHostname();
            const response = await fetch(`${AUTH_ENDPOINT}/me`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Tenant': tenant
              }
            });

            if (response.ok) {
              const { data } = await response.json();
              setUser(data.user);
              // Note: Navigation will be handled by the LoginForm component
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (data.user) {
        // Get user profile from our backend
        const token = data.session?.access_token;
        if (token) {
          const tenant = extractTenantFromHostname();
          const response = await fetch(`${AUTH_ENDPOINT}/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Tenant': tenant
            }
          });

          if (response.ok) {
            const { data: profileData } = await response.json();
            setUser(profileData.user);
            return { success: true, message: 'Login successful' };
          }
        }
      }

      return { success: false, message: 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'An error occurred during login' };
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const tenant = extractTenantFromHostname();
      const response = await fetch(`${AUTH_ENDPOINT}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': tenant
        },
        body: JSON.stringify({ ...payload, tenant })
      });

      const result = await response.json();

      if (result.success) {
        // Sign in the user after successful registration
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email,
          password: payload.password
        });

        if (!error && data.user) {
          setUser(result.data.user);
          // Note: Navigation will be handled by the RegisterForm component
          return { success: true, message: 'Registration successful' };
        }
      }

      return { success: false, message: result.message || 'Registration failed' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'An error occurred during registration' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const tenant = extractTenantFromHostname();
      const response = await fetch(`${AUTH_ENDPOINT}/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant': tenant
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const { data } = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const tenant = extractTenantFromHostname();
      const response = await fetch(`${AUTH_ENDPOINT}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant': tenant
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return { success: result.success, message: result.message };
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, message: 'An error occurred. Please try again later.' };
    }
  };

  const resetPassword = async (password: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return { success: false, message: 'Authentication required' };

      const tenant = extractTenantFromHostname();
      const response = await fetch(`${AUTH_ENDPOINT}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant': tenant
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();
      return { success: result.success, message: result.message };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'An error occurred. Please try again later.' };
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    forgotPassword,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

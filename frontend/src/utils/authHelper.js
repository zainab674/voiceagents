import { supabase } from '@/lib/supabase';

// Authentication helper for handling expired tokens
export const handleAuthError = async (error, navigate) => {
  if (error.response?.status === 401 || error.response?.status === 403) {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Redirect to login page
    if (navigate) {
      navigate('/login');
    } else {
      window.location.href = '/login';
    }
    
    return true; // Indicates auth error was handled
  }
  return false; // Not an auth error
};

// Check if user is authenticated
export const isAuthenticated = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    return false;
  }
};

export default { handleAuthError, isAuthenticated };

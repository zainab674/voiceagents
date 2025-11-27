import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { API_BASE_URL } from '../constants/URLConstant';
import { extractTenantFromHostname } from '../lib/tenant-utils';
import { supabase } from '../lib/supabase';

export interface WebsiteSettings {
  slug_name?: string | null;
  custom_domain?: string | null;
  website_name?: string | null;
  websiteName?: string | null;
  logo?: string | null;
  contact_email?: string | null;
  meta_description?: string | null;
  live_demo_agent_id?: string | null;
  live_demo_phone_number?: string | null;
  policy_text?: string | null;
  landing_category?: string | null;
  landingCategory?: string | null;
}

interface WebsiteSettingsContextType {
  settings: WebsiteSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<WebsiteSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
}

const WebsiteSettingsContext = createContext<WebsiteSettingsContextType | undefined>(undefined);

export const useWebsiteSettings = () => {
  const context = useContext(WebsiteSettingsContext);
  if (context === undefined) {
    throw new Error('useWebsiteSettings must be used within a WebsiteSettingsProvider');
  }
  return context;
};

interface WebsiteSettingsProviderProps {
  children: ReactNode;
}

export const WebsiteSettingsProvider: React.FC<WebsiteSettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const tenant = extractTenantFromHostname();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant': tenant
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/whitelabel/website-settings?tenant=${tenant}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to fetch website settings');
      }

      const result = await response.json();
      if (result.success) {
        setSettings(result.settings || {});
      } else {
        throw new Error(result.message || 'Failed to fetch settings');
      }
    } catch (err: any) {
      console.error('Error fetching website settings:', err);
      setError(err.message);
      setSettings({}); // Set empty settings on error
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<WebsiteSettings>) => {
    try {
      setError(null);
      const tenant = extractTenantFromHostname();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/whitelabel/website-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-tenant': tenant
        },
        body: JSON.stringify({
          tenant,
          ...updates
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update website settings');
      }

      const result = await response.json();
      if (result.success) {
        setSettings(prev => ({ ...prev, ...updates }));
      } else {
        throw new Error(result.message || 'Failed to update settings');
      }
    } catch (err: any) {
      console.error('Error updating website settings:', err);
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const uploadLogo = async (file: File) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Authentication required');
      }

      const tenant = extractTenantFromHostname();
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`${API_BASE_URL}/whitelabel/website-settings/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant': tenant
        },
        body: formData
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to upload logo');
      }

      if (result.data?.url) {
        setSettings(prev => ({ ...prev, logo: result.data.url }));
      }

      return result.data?.url;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  };

  return (
    <WebsiteSettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        updateSettings,
        refreshSettings: fetchSettings,
        uploadLogo
      }}
    >
      {children}
    </WebsiteSettingsContext.Provider>
  );
};



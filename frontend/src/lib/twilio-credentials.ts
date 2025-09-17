export interface TwilioCredentials {
  id: string;
  account_sid: string;
  auth_token: string;
  user_id: string;
  label?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Get active Twilio credentials for the current user
 */
export async function getActiveTwilioCredentials(): Promise<TwilioCredentials | null> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/twilio-credentials/active`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.credentials || null;
  } catch (error) {
    console.error('Error fetching Twilio credentials:', error);
    return null;
  }
}

/**
 * Set active Twilio credentials
 */
export async function setActiveTwilioCredentials(credentialsId: string): Promise<boolean> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/twilio-credentials/active`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credentialsId })
    });

    return response.ok;
  } catch (error) {
    console.error('Error setting active Twilio credentials:', error);
    return false;
  }
}

/**
 * Test Twilio credentials
 */
export async function testTwilioCredentials(accountSid: string, authToken: string): Promise<boolean> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/twilio-credentials/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountSid, authToken })
    });

    const result = await response.json();
    return result.success || false;
  } catch (error) {
    console.error('Error testing Twilio credentials:', error);
    return false;
  }
}

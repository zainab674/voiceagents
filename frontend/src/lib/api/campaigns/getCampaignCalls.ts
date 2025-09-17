// lib/api/campaigns/getCampaignCalls.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface CampaignCall {
  id: string;
  campaign_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'do_not_call';
  outcome?: string;
  call_duration?: number;
  call_sid?: string;
  room_name?: string;
  created_at: string;
  updated_at: string;
  called_at?: string;
  completed_at?: string;
}

export const getCampaignCalls = async (campaignId: string): Promise<CampaignCall[]> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      console.error('No authentication token available');
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/calls`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error getting campaign calls:', error);
    return [];
  }
};
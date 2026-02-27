// lib/api/campaigns/getCampaignCalls.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface CampaignCall {
  id: string;
  campaign_id: string;
  contact_id?: string;
  contact_name: string;
  phone_number: string; // instead of contact_phone
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'do_not_call';
  outcome?: string;
  call_duration: number;
  call_sid?: string;
  room_name?: string;
  notes?: string;
  started_at: string; // instead of created_at
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export const getCampaignCalls = async (params: { campaignId: string, limit?: number }): Promise<{ success: boolean; calls?: CampaignCall[]; error?: string }> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      console.error('No authentication token available');
      return { success: false, error: 'No authentication token available' };
    }

    const url = new URL(`${API_BASE_URL}/api/v1/campaigns/${params.campaignId}/calls`);
    if (params.limit) {
      url.searchParams.append('limit', params.limit.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, calls: data.data || [] };
  } catch (error) {
    console.error('Error getting campaign calls:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
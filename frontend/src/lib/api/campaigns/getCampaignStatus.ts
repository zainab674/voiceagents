// lib/api/campaigns/getCampaignStatus.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface CampaignStatus {
  id: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  execution_status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  dials: number;
  pickups: number;
  do_not_call: number;
  interested: number;
  not_interested: number;
  callback: number;
  total_usage: number;
  current_daily_calls: number;
  total_calls_made: number;
  total_calls_answered: number;
  last_execution_at: string | null;
  next_call_at: string | null;
}

export const getCampaignStatus = async (campaignId: string): Promise<CampaignStatus | null> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      console.error('No authentication token available');
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error getting campaign status:', error);
    return null;
  }
};
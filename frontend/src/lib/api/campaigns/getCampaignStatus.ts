// lib/api/campaigns/getCampaignStatus.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface CampaignStatus {
  id: string;
  name: string;
  assistant_id: string;
  assistant_name?: string;
  contact_source: 'contact_list' | 'csv_file';
  daily_cap: number;
  calling_days: string[];
  start_hour: number;
  end_hour: number;
  campaign_prompt: string;
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
  created_at: string;
  updated_at: string;
  stats?: {
    total: number;
    completed: number;
    failed: number;
    answered: number;
    noAnswer: number;
    busy: number;
    interested: number;
    notInterested: number;
    callback: number;
    doNotCall: number;
  };
  queueStatus?: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export const getCampaignStatus = async (campaignId: string): Promise<any> => {
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
    return data;
  } catch (error) {
    console.error('Error getting campaign status:', error);
    return null;
  }
};
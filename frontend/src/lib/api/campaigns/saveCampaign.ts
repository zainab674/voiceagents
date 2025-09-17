// lib/api/campaigns/saveCampaign.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface SaveCampaignRequest {
  name: string;
  assistantId: string;
  contactSource: 'contact_list' | 'csv_file';
  contactListId?: string;
  csvFileId?: string;
  dailyCap: number;
  callingDays: string[];
  startHour: number;
  endHour: number;
  campaignPrompt: string;
  userId: string;
}

export interface SaveCampaignResponse {
  success: boolean;
  campaignId?: string;
  error?: string;
}

/**
 * Save campaign to database
 */
export const saveCampaign = async (data: SaveCampaignRequest): Promise<SaveCampaignResponse> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return {
        success: false,
        error: 'Authentication required. Please log in again.'
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/campaigns`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving campaign:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};
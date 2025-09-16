// lib/api/campaigns/deleteCampaign.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const deleteCampaign = async (campaignId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return { 
        success: false, 
        error: 'Authentication required. Please log in again.' 
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/campaigns/${campaignId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};
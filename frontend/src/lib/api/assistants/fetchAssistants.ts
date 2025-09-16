import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface Assistant {
  id: string;
  name: string;
  prompt: string;
  first_message?: string;
  llm_provider_setting?: string;
  llm_model_setting?: string;
  temperature_setting?: number;
  max_token_setting?: number;
  cal_api_key?: string;
  cal_event_type_id?: string;
  cal_timezone?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export async function fetchAssistants(): Promise<Assistant[]> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/agents`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data?.agents || [];
  } catch (error) {
    console.error('Error in fetchAssistants:', error);
    throw error;
  }
}
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface Agent {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface FetchAgentsResponse {
  success: boolean;
  data: {
    agents: Agent[];
  };
}

export async function fetchAgents(): Promise<Agent[]> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/agents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }

    const data: FetchAgentsResponse = await response.json();
    return data.data.agents || [];
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

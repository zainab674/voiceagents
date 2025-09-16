import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  total_contacts: number;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export async function fetchContactLists(): Promise<ContactList[]> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/csv/contact-lists`, {
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
    console.error('Error in fetchContactLists:', error);
    throw error;
  }
}
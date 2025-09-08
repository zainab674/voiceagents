// lib/api/transcription/saveTranscription.ts
import { supabase } from '@/lib/supabase';

export interface TranscriptionItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SaveTranscriptionRequest {
  callId: string;
  transcription: TranscriptionItem[];
}

export interface SaveTranscriptionResponse {
  success: boolean;
  data?: {
    call: any;
  };
  message?: string;
}

/**
 * Save transcription data for a call
 */
export const saveTranscription = async (request: SaveTranscriptionRequest): Promise<SaveTranscriptionResponse> => {
  try {
    // Get the current session token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/calls/transcription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to save transcription: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error saving transcription:', error);
    throw error;
  }
};

/**
 * Add a new transcription item to an existing call
 */
export const addTranscriptionItem = async (
  callId: string, 
  role: 'user' | 'assistant' | 'system', 
  content: string
): Promise<SaveTranscriptionResponse> => {
  try {
    // Get the current session token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // First, get the existing transcription
    const getResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/calls/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!getResponse.ok) {
      throw new Error('Failed to fetch existing call data');
    }

    const { data: { calls } } = await getResponse.json();
    const call = calls.find((c: any) => c.id === callId);
    
    if (!call) {
      throw new Error('Call not found');
    }

    // Add the new transcription item
    const existingTranscription = call.transcription || [];
    const newTranscription = [
      ...existingTranscription,
      { role, content }
    ];

    // Save the updated transcription
    return await saveTranscription({
      callId,
      transcription: newTranscription
    });

  } catch (error) {
    console.error('Error adding transcription item:', error);
    throw error;
  }
};


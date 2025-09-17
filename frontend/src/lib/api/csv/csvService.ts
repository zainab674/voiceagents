// lib/api/csv/csvService.ts
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface CsvFile {
  id: string;
  name: string;
  user_id: string;
  row_count: number;
  file_size?: number;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

export interface CsvContact {
  id: string;
  csv_file_id: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive' | 'do-not-call';
  do_not_call: boolean;
  user_id: string;
  created_at: string;
}

export interface CsvUploadResponse {
  success: boolean;
  message: string;
  csvFileId?: string;
  contactCount?: number;
  error?: string;
}

export interface CsvFilesResponse {
  success: boolean;
  csvFiles: CsvFile[];
  error?: string;
}

export interface CsvContactsResponse {
  success: boolean;
  contacts: CsvContact[];
  error?: string;
}

export interface CsvStats {
  total: number;
  active: number;
  inactive: number;
  doNotCall: number;
  withPhone: number;
  withEmail: number;
}

export interface CsvStatsResponse {
  success: boolean;
  stats: CsvStats;
  error?: string;
}

/**
 * Upload CSV file
 */
export const uploadCsvFile = async (file: File): Promise<CsvUploadResponse> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return {
        success: false,
        message: 'Authentication required. Please log in again.',
        error: 'No valid token found'
      };
    }

    const formData = new FormData();
    formData.append('csvFile', file);

    const response = await fetch(`${API_BASE_URL}/api/v1/csv/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error uploading CSV file:', error);
    return {
      success: false,
      message: 'Failed to upload CSV file',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Fetch CSV files for the current user
 */
export const fetchCsvFiles = async (): Promise<CsvFilesResponse> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return {
        success: false,
        csvFiles: [],
        error: 'Authentication required. Please log in again.'
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/csv`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error fetching CSV files:', error);
    return {
      success: false,
      csvFiles: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Fetch CSV contacts for a specific CSV file
 */
export const fetchCsvContacts = async (csvFileId: string, limit = 100, offset = 0): Promise<CsvContactsResponse> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return {
        success: false,
        contacts: [],
        error: 'Authentication required. Please log in again.'
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/csv/${csvFileId}/contacts?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error fetching CSV contacts:', error);
    return {
      success: false,
      contacts: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Get CSV file statistics
 */
export const fetchCsvStats = async (csvFileId: string): Promise<CsvStatsResponse> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return {
        success: false,
        stats: {
          total: 0,
          active: 0,
          inactive: 0,
          doNotCall: 0,
          withPhone: 0,
          withEmail: 0
        },
        error: 'Authentication required. Please log in again.'
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/csv/${csvFileId}/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error fetching CSV stats:', error);
    return {
      success: false,
      stats: {
        total: 0,
        active: 0,
        inactive: 0,
        doNotCall: 0,
        withPhone: 0,
        withEmail: 0
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Delete CSV file
 */
export const deleteCsvFile = async (csvFileId: string): Promise<{ success: boolean; message?: string; error?: string; campaigns?: Array<{ id: string; name: string }> }> => {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      return {
        success: false,
        error: 'Authentication required. Please log in again.'
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/csv/${csvFileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error deleting CSV file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Parse CSV content (client-side parsing for preview)
 */
export const parseCsvContent = (csvText: string): CsvContact[] => {
  try {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const contacts: CsvContact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Map common column names to our interface
      const contact: CsvContact = {
        id: `temp-${i}`,
        csv_file_id: 'temp',
        first_name: row.first_name || row.firstname || row.first || row.fname || '',
        last_name: row.last_name || row.lastname || row.last || row.lname || '',
        phone: row.phone || row.phone_number || row.telephone || row.mobile || '',
        email: row.email || row.email_address || row.e_mail || '',
        status: (row.status || 'active') as 'active' | 'inactive' | 'do-not-call',
        do_not_call: row.do_not_call === 'true' || row.dnd === 'true' || row.do_not_call === '1' || row.dnd === '1' || false,
        user_id: 'temp',
        created_at: new Date().toISOString()
      };

      // Only add if we have at least first name and either phone or email
      if (contact.first_name && (contact.phone || contact.email)) {
        contacts.push(contact);
      }
    }

    return contacts;

  } catch (error) {
    console.error('Error parsing CSV content:', error);
    return [];
  }
};

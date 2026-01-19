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
    // Handle different line endings and filter out truly empty lines
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    const separators = [',', ';', '\t'];
    let delimiter = ',';
    let maxCols = 0;

    separators.forEach(sep => {
      const cols = firstLine.split(sep).length;
      if (cols > maxCols) {
        maxCols = cols;
        delimiter = sep;
      }
    });

    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const contacts: CsvContact[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/['"]/g, ''));

      // If the row doesn't have enough columns, skip it
      if (values.length < Math.min(2, headers.length)) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          row[header] = values[index] || '';
        }
      });

      // Flexible column finding
      const findValue = (keywords: string[]) => {
        const key = Object.keys(row).find(k => keywords.some(kw => k.includes(kw)));
        return key ? row[key] : '';
      };

      let firstName = findValue(['first_name', 'firstname', 'first', 'fname']);
      let lastName = findValue(['last_name', 'lastname', 'last', 'lname']);
      const phone = findValue(['phone', 'telephone', 'mobile', 'cell', 'number', 'ph']);
      const email = findValue(['email', 'e_mail', 'mail', 'addr']);
      const fullName = findValue(['name', 'contact', 'full']);

      // If first_name is missing but we have a full name, try to split it
      if (!firstName && fullName) {
        const parts = fullName.split(' ');
        firstName = parts[0];
        if (!lastName && parts.length > 1) {
          lastName = parts.slice(1).join(' ');
        }
      }

      // If we still don't have a first name, use any name-like column or the first column if it's not a known type
      if (!firstName && fullName) firstName = fullName;

      const contact: CsvContact = {
        id: `temp-${i}`,
        csv_file_id: 'temp',
        first_name: firstName,
        last_name: lastName,
        phone: phone || '0', // Default to '0' if no phone number
        email,
        status: (row.status || 'active') as 'active' | 'inactive' | 'do-not-call',
        do_not_call: row.do_not_call === 'true' || row.dnd === 'true' || row.do_not_call === '1' || row.dnd === '1' || false,
        user_id: 'temp',
        created_at: new Date().toISOString()
      };

      // Validation: Must have a name and (phone or email)
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

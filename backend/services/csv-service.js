// services/csv-service.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class CsvService {
  /**
   * Save CSV file metadata to database
   */
  async saveCsvFile({ name, rowCount, fileSize, userId }) {
    try {
      const { data: csvFile, error } = await supabase
        .from('csv_files')
        .insert([{
          filename: name,
          original_filename: name,
          user_id: userId,
          total_contacts: rowCount,
          processed_contacts: rowCount,
          file_size: fileSize || null,
          status: 'completed'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving CSV file:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        csvFileId: csvFile.id
      };

    } catch (error) {
      console.error('Error saving CSV file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Save CSV contacts to database
   */
  async saveCsvContacts({ csvFileId, contacts, userId }) {
    try {
      // Prepare contacts for insertion
      const contactsToInsert = contacts.map(contact => ({
        csv_file_id: csvFileId,
        name: `${contact.first_name} ${contact.last_name || ''}`.trim(),
        phone_number: contact.phone || null,
        email: contact.email || null,
        company: null, // Not provided in current CSV format
        do_not_call: contact.do_not_call || false
      }));

      const { data: savedContacts, error } = await supabase
        .from('csv_contacts')
        .insert(contactsToInsert)
        .select();

      if (error) {
        console.error('Error saving CSV contacts:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        savedCount: savedContacts?.length || 0
      };

    } catch (error) {
      console.error('Error saving CSV contacts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Fetch CSV files for a user
   */
  async getCsvFiles(userId) {
    try {
      const { data: csvFiles, error } = await supabase
        .from('csv_files')
        .select(`
          *,
          csv_contacts(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the data to match frontend expectations
      const transformedFiles = (csvFiles || []).map(file => ({
        id: file.id,
        name: file.filename,
        user_id: file.user_id,
        row_count: file.total_contacts,
        file_size: file.file_size,
        uploaded_at: file.created_at,
        created_at: file.created_at,
        updated_at: file.updated_at,
        contact_count: file.csv_contacts?.[0]?.count || 0
      }));

      return {
        success: true,
        csvFiles: transformedFiles
      };

    } catch (error) {
      console.error('Error fetching CSV files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch CSV contacts for a specific CSV file
   */
  async getCsvContacts(csvFileId, options = {}) {
    try {
      const { limit = 100, offset = 0 } = options;

      const { data: contacts, error } = await supabase
        .from('csv_contacts')
        .select('*')
        .eq('csv_file_id', csvFileId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Transform the data to match frontend expectations
      const transformedContacts = (contacts || []).map(contact => ({
        id: contact.id,
        csv_file_id: contact.csv_file_id,
        first_name: contact.name?.split(' ')[0] || '',
        last_name: contact.name?.split(' ').slice(1).join(' ') || '',
        phone: contact.phone_number,
        email: contact.email,
        status: 'active', // Default status
        do_not_call: contact.do_not_call,
        user_id: '', // Will be filled by the calling function
        created_at: contact.created_at
      }));

      return {
        success: true,
        contacts: transformedContacts
      };

    } catch (error) {
      console.error('Error fetching CSV contacts:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get CSV file details
   */
  async getCsvFile(csvFileId) {
    try {
      const { data: csvFile, error } = await supabase
        .from('csv_files')
        .select(`
          *,
          csv_contacts(count)
        `)
        .eq('id', csvFileId)
        .single();

      if (error || !csvFile) {
        return {
          success: false,
          error: 'CSV file not found'
        };
      }

      return {
        success: true,
        csvFile: {
          ...csvFile,
          contact_count: csvFile.csv_contacts?.[0]?.count || 0
        }
      };

    } catch (error) {
      console.error('Error fetching CSV file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete CSV file
   */
  async deleteCsvFile(csvFileId) {
    try {
      // Check if any campaigns are using this CSV file
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name, execution_status')
        .eq('csv_file_id', csvFileId);

      if (campaignsError) {
        console.error('Error checking campaigns:', campaignsError);
      }

      if (campaigns && campaigns.length > 0) {
        const activeCampaigns = campaigns.filter(c => c.execution_status === 'running');
        if (activeCampaigns.length > 0) {
          return {
            success: false,
            error: `Cannot delete CSV file. It is being used by ${activeCampaigns.length} running campaign(s). Please stop the campaigns first.`,
            campaigns: activeCampaigns.map(c => ({ id: c.id, name: c.name }))
          };
        }

        return {
          success: false,
          error: `Cannot delete CSV file. It is being used by ${campaigns.length} campaign(s). Please delete or change the campaigns first.`,
          campaigns: campaigns.map(c => ({ id: c.id, name: c.name }))
        };
      }

      // Delete the CSV file (this will cascade delete related csv_contacts due to foreign key constraints)
      const { error: deleteError } = await supabase
        .from('csv_files')
        .delete()
        .eq('id', csvFileId);

      if (deleteError) {
        throw deleteError;
      }

      return {
        success: true,
        message: 'CSV file deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting CSV file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse CSV content and extract contacts
   */
  parseCsvContent(csvText) {
    try {
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const contacts = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
        if (values.length !== headers.length) continue;

        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Map common column names to our interface
        const contact = {
          first_name: row.first_name || row.firstname || row.first || row.fname || '',
          last_name: row.last_name || row.lastname || row.last || row.lname || '',
          phone: row.phone || row.phone_number || row.telephone || row.mobile || '',
          email: row.email || row.email_address || row.e_mail || '',
          status: (row.status || 'active'),
          do_not_call: row.do_not_call === 'true' || row.dnd === 'true' || row.do_not_call === '1' || row.dnd === '1' || false
        };

        // Only add if we have at least first name and either phone or email
        if (contact.first_name && (contact.phone || contact.email)) {
          contacts.push(contact);
        }
      }

      return contacts;

    } catch (error) {
      console.error('Error parsing CSV content:', error);
      throw new Error('Failed to parse CSV content');
    }
  }

  /**
   * Validate CSV file
   */
  validateCsvFile(file) {
    const errors = [];

    // Check file type - use originalname for multer memory storage
    const fileName = file.originalname || file.name;
    if (!fileName || !fileName.toLowerCase().endsWith('.csv')) {
      errors.push('File must be a CSV file');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push('File size must be less than 10MB');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get CSV file statistics
   */
  async getCsvFileStats(csvFileId) {
    try {
      const { data: contacts, error } = await supabase
        .from('csv_contacts')
        .select('phone_number, email, do_not_call')
        .eq('csv_file_id', csvFileId);

      if (error) {
        throw error;
      }

      const stats = {
        total: contacts.length,
        active: contacts.length, // All contacts are considered active in current schema
        inactive: 0, // No inactive status in current schema
        doNotCall: contacts.filter(c => c.do_not_call).length,
        withPhone: contacts.filter(c => c.phone_number && c.phone_number.trim()).length,
        withEmail: contacts.filter(c => c.email && c.email.trim()).length
      };

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('Error fetching CSV file stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const csvService = new CsvService();
export { CsvService };

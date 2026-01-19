import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Base CRM Service class
 */
class CRMService {
  constructor(userId, platform, credentials = null) {
    this.userId = userId;
    this.platform = platform;
    this.credentials = credentials;
    this.logger = console;
  }

  async getCredentials() {
    if (this.credentials) return this.credentials;

    const { data, error } = await supabase
      .from('user_crm_credentials')
      .select('*')
      .eq('user_id', this.userId)
      .eq('crm_platform', this.platform)
      .eq('is_active', true)
      .single();

    if (error) {
      throw new Error(`Failed to get ${this.platform} credentials: ${error.message}`);
    }

    this.credentials = data;
    return data;
  }

  async refreshToken() {
    // Override in subclasses
    throw new Error('Token refresh not implemented');
  }

  async makeRequest(method, url, data = null, headers = {}) {
    const credentials = await this.getCredentials();

    // Check if token is expired
    if (credentials.expires_at && new Date(credentials.expires_at) <= new Date()) {
      await this.refreshToken();
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    try {
      const response = await axios({
        method,
        url,
        data,
        headers: requestHeaders,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      this.logger.error(`${this.platform} API Error:`, {
        method,
        url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      });

      if (error.response?.status === 401) {
        // Token expired, try to refresh
        try {
          await this.refreshToken();
          // Retry the request
          const retryResponse = await axios({
            method,
            url,
            data,
            headers: requestHeaders,
            timeout: 30000
          });
          return retryResponse.data;
        } catch (retryError) {
          throw new Error(`Authentication failed for ${this.platform}: ${retryError.message}`);
        }
      }

      throw error;
    }
  }

  async storeContacts(contacts) {
    const contactsToStore = contacts.map(contact => ({
      user_id: this.userId,
      crm_platform: this.platform,
      crm_contact_id: contact.id,
      first_name: contact.first_name || contact.firstname,
      last_name: contact.last_name || contact.lastname,
      email: contact.email,
      phone: contact.phone,
      company: contact.company || contact.company_name,
      job_title: contact.job_title || contact.jobtitle,
      raw_data: contact,
      last_synced_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('crm_contacts')
      .upsert(contactsToStore, {
        onConflict: 'user_id,crm_platform,crm_contact_id'
      });

    if (error) {
      throw new Error(`Failed to store ${this.platform} contacts: ${error.message}`);
    }

    return contactsToStore.length;
  }

  async fetchContacts(params = {}) {
    // Override in subclasses
    throw new Error('Fetch contacts not implemented');
  }

  async createContact(contactData) {
    // Override in subclasses
    throw new Error('Create contact not implemented');
  }
}

/**
 * HubSpot CRM Service
 */
class HubSpotService extends CRMService {
  constructor(userId, credentials = null) {
    super(userId, 'hubspot', credentials);
    this.baseUrl = 'https://api.hubapi.com';
    this.apiVersion = 'v3';
  }

  async getAuthHeaders() {
    const credentials = await this.getCredentials();
    return {
      'Authorization': `Bearer ${credentials.access_token}`
    };
  }

  async refreshToken() {
    const credentials = await this.getCredentials();

    if (!credentials.refresh_token) {
      throw new Error('No refresh token available for HubSpot');
    }

    // Get user's app credentials for token refresh
    const { data: appCredentials, error: appError } = await supabase
      .from('user_crm_app_credentials')
      .select('*')
      .eq('user_id', this.userId)
      .eq('crm_platform', 'hubspot')
      .eq('is_active', true)
      .single();

    if (appError || !appCredentials) {
      throw new Error('HubSpot app credentials not found for token refresh');
    }

    try {
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
        client_id: appCredentials.client_id,
        client_secret: appCredentials.client_secret
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

      // Update credentials in database
      const { error } = await supabase
        .from('user_crm_credentials')
        .update({
          access_token,
          refresh_token,
          expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', credentials.id);

      if (error) {
        throw new Error(`Failed to update HubSpot credentials: ${error.message}`);
      }

      // Update local credentials
      this.credentials = {
        ...credentials,
        access_token,
        refresh_token,
        expires_at
      };

    } catch (error) {
      throw new Error(`Failed to refresh HubSpot token: ${error.message}`);
    }
  }

  async fetchContacts(params = {}) {
    const { limit = 100, after, properties = ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle'] } = params;

    const url = `${this.baseUrl}/crm/${this.apiVersion}/objects/contacts`;
    const headers = await this.getAuthHeaders();

    const queryParams = {
      limit,
      properties: properties.join(','),
      ...(after && { after })
    };

    const response = await this.makeRequest('GET', url, null, headers);

    // Transform HubSpot response to standard format
    const contacts = response.results.map(contact => ({
      id: contact.id,
      first_name: contact.properties.firstname,
      last_name: contact.properties.lastname,
      email: contact.properties.email,
      phone: contact.properties.phone,
      company: contact.properties.company,
      job_title: contact.properties.jobtitle,
      created_at: contact.createdAt,
      updated_at: contact.updatedAt,
      raw_data: contact
    }));

    return {
      contacts,
      paging: response.paging
    };
  }

  async createContact(contactData) {
    const url = `${this.baseUrl}/crm/${this.apiVersion}/objects/contacts`;
    const headers = await this.getAuthHeaders();

    const properties = {
      firstname: contactData.first_name,
      lastname: contactData.last_name,
      email: contactData.email,
      phone: contactData.phone,
      company: contactData.company,
      jobtitle: contactData.job_title
    };

    const response = await this.makeRequest('POST', url, { properties }, headers);
    return response;
  }

  async getAccountInfo() {
    const url = `${this.baseUrl}/crm/${this.apiVersion}/objects/accounts`;
    const headers = await this.getAuthHeaders();

    const response = await this.makeRequest('GET', url, null, headers);
    return response;
  }
}

/**
 * Zoho CRM Service
 */
class ZohoService extends CRMService {
  constructor(userId, credentials = null) {
    super(userId, 'zoho', credentials);
    this.baseUrl = 'https://www.zohoapis.com/crm/v2';
  }

  async getAuthHeaders() {
    const credentials = await this.getCredentials();
    return {
      'Authorization': `Zoho-oauthtoken ${credentials.access_token}`
    };
  }

  async refreshToken() {
    const credentials = await this.getCredentials();

    if (!credentials.refresh_token) {
      throw new Error('No refresh token available for Zoho');
    }

    // Get user's app credentials for token refresh
    const { data: appCredentials, error: appError } = await supabase
      .from('user_crm_app_credentials')
      .select('*')
      .eq('user_id', this.userId)
      .eq('crm_platform', 'zoho')
      .eq('is_active', true)
      .single();

    if (appError || !appCredentials) {
      throw new Error('Zoho app credentials not found for token refresh');
    }

    try {
      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', {
        refresh_token: credentials.refresh_token,
        client_id: appCredentials.client_id,
        client_secret: appCredentials.client_secret,
        grant_type: 'refresh_token'
      });

      const { access_token, expires_in } = response.data;
      const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

      // Update credentials in database
      const { error } = await supabase
        .from('user_crm_credentials')
        .update({
          access_token,
          expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', credentials.id);

      if (error) {
        throw new Error(`Failed to update Zoho credentials: ${error.message}`);
      }

      // Update local credentials
      this.credentials = {
        ...credentials,
        access_token,
        expires_at
      };

    } catch (error) {
      throw new Error(`Failed to refresh Zoho token: ${error.message}`);
    }
  }

  async fetchContacts(params = {}) {
    const { page = 1, per_page = 200 } = params;

    const url = `${this.baseUrl}/Contacts`;
    const headers = await this.getAuthHeaders();

    const queryParams = {
      page,
      per_page
    };

    const response = await this.makeRequest('GET', url, null, headers);

    // Transform Zoho response to standard format
    const contacts = response.data.map(contact => ({
      id: contact.id,
      first_name: contact.First_Name,
      last_name: contact.Last_Name,
      email: contact.Email,
      phone: contact.Phone,
      company: contact.Account_Name?.name,
      job_title: contact.Title,
      created_at: contact.Created_Time,
      updated_at: contact.Modified_Time,
      raw_data: contact
    }));

    return {
      contacts,
      info: response.info
    };
  }

  async createContact(contactData) {
    const url = `${this.baseUrl}/Contacts`;
    const headers = await this.getAuthHeaders();

    const data = {
      data: [{
        First_Name: contactData.first_name,
        Last_Name: contactData.last_name,
        Email: contactData.email,
        Phone: contactData.phone,
        Title: contactData.job_title
      }]
    };

    const response = await this.makeRequest('POST', url, data, headers);
    return response;
  }

  async getAccountInfo() {
    const url = `${this.baseUrl}/Accounts`;
    const headers = await this.getAuthHeaders();

    const response = await this.makeRequest('GET', url, null, headers);
    return response;
  }
}

/**
 * Multi-CRM Service Manager
 */
class MultiCRMService {
  constructor(userId) {
    this.userId = userId;
    this.services = new Map();
    this.logger = console;
  }

  async initializeServices() {
    const credentials = await this.getUserCRMCredentials();

    for (const credential of credentials) {
      if (credential.is_active) {
        switch (credential.crm_platform) {
          case 'hubspot':
            this.services.set('hubspot', new HubSpotService(this.userId, credential));
            break;
          case 'zoho':
            this.services.set('zoho', new ZohoService(this.userId, credential));
            break;
        }
      }
    }
  }

  async getUserCRMCredentials() {
    const { data, error } = await supabase
      .from('user_crm_credentials')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get CRM credentials: ${error.message}`);
    }

    return data;
  }

  async getAllContacts(filters = {}) {
    await this.initializeServices();
    const allContacts = [];

    for (const [platform, service] of this.services) {
      try {
        const result = await service.fetchContacts(filters);
        const contacts = result.contacts || result.data || [];

        // Add platform identifier to each contact
        const platformContacts = contacts.map(contact => ({
          ...contact,
          source_platform: platform,
          source_account: service.credentials?.account_name || platform
        }));
        allContacts.push(...platformContacts);
      } catch (error) {
        this.logger.error(`Error fetching contacts from ${platform}:`, error);
        // Continue with other platforms even if one fails
      }
    }

    return allContacts;
  }

  async syncAllPlatforms() {
    await this.initializeServices();
    const results = {};

    for (const [platform, service] of this.services) {
      try {
        const result = await service.fetchContacts();
        const contacts = result.contacts || result.data || [];
        const storedCount = await service.storeContacts(contacts);
        results[platform] = { success: true, count: storedCount };
      } catch (error) {
        results[platform] = { success: false, error: error.message };
      }
    }

    return results;
  }

  async syncPlatform(platform) {
    await this.initializeServices();
    const service = this.services.get(platform);

    if (!service) {
      throw new Error(`Platform ${platform} not connected. Please go to the Integrations tab and connect your ${platform} account.`);
    }

    try {
      const result = await service.fetchContacts();
      const contacts = result.contacts || result.data || [];
      const storedCount = await service.storeContacts(contacts);
      return { success: true, count: storedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createContactInPlatform(platform, contactData) {
    await this.initializeServices();
    const service = this.services.get(platform);

    if (!service) {
      throw new Error(`Platform ${platform} not connected. Please go to the Integrations tab and connect your ${platform} account.`);
    }

    return await service.createContact(contactData);
  }

  async createContactInAllPlatforms(contactData) {
    await this.initializeServices();
    const results = {};

    for (const [platform, service] of this.services) {
      try {
        const result = await service.createContact(contactData);
        results[platform] = { success: true, contact: result };
      } catch (error) {
        results[platform] = { success: false, error: error.message };
      }
    }

    return results;
  }

  async getStoredContacts(filters = {}) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('user_id', this.userId)
      .order('last_synced_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get stored contacts: ${error.message}`);
    }

    // Apply filters
    let filteredData = data;

    if (filters.platform) {
      filteredData = filteredData.filter(contact => contact.crm_platform === filters.platform);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredData = filteredData.filter(contact =>
        contact.first_name?.toLowerCase().includes(searchTerm) ||
        contact.last_name?.toLowerCase().includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm) ||
        contact.company?.toLowerCase().includes(searchTerm)
      );
    }

    return filteredData;
  }

  async disconnectPlatform(platform) {
    const { error } = await supabase
      .from('user_crm_credentials')
      .update({ is_active: false })
      .eq('user_id', this.userId)
      .eq('crm_platform', platform);

    if (error) {
      throw new Error(`Failed to disconnect ${platform}: ${error.message}`);
    }

    // Remove from services map
    this.services.delete(platform);

    return true;
  }
}

export { CRMService, HubSpotService, ZohoService, MultiCRMService };

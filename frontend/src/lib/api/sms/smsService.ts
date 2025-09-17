import { getActiveTwilioCredentials } from '@/lib/twilio-credentials';
import { supabase } from '@/lib/supabase';

export interface SMSMessage {
  messageSid: string;
  to: string;
  from: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  dateCreated: string;
  dateSent?: string;
  dateUpdated: string;
  errorCode?: string;
  errorMessage?: string;
  numSegments?: string;
  price?: string;
  priceUnit?: string;
}

export interface SendSMSRequest {
  to: string;
  from: string;
  body: string;
  conversationId?: string;
}

export interface SendSMSResponse {
  success: boolean;
  message: string;
  data?: SMSMessage;
}

export interface GetSMSMessagesResponse {
  success: boolean;
  data: SMSMessage[];
}

/**
 * SMS Service for handling SMS operations
 */
export class SMSService {
  private static getBackendUrl(): string {
    // Prioritize ngrok for development, fallback to backend URL for production
    return import.meta.env.VITE_NGROK_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  }

  /**
   * Send an SMS message
   */
  static async sendSMS(request: SendSMSRequest): Promise<SendSMSResponse> {
    try {
      const credentials = await getActiveTwilioCredentials();
      if (!credentials) {
        throw new Error('No active Twilio credentials found. Please configure your Twilio settings.');
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${this.getBackendUrl()}/api/v1/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accountSid: credentials.account_sid,
          authToken: credentials.auth_token,
          to: request.to,
          from: request.from,
          body: request.body,
          conversationId: request.conversationId,
          userId: credentials.user_id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to send SMS');
      }

      return result;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Get SMS messages for a conversation
   */
  static async getSMSMessages(conversationId: string): Promise<SMSMessage[]> {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(
        `${this.getBackendUrl()}/api/v1/sms/conversation/${conversationId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result: GetSMSMessagesResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch SMS messages');
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching SMS messages:', error);
      throw error;
    }
  }

  /**
   * Get SMS messages by phone number
   */
  static async getSMSMessagesByPhoneNumber(phoneNumber: string): Promise<SMSMessage[]> {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Use the conversation endpoint to get SMS messages for this phone number
      const response = await fetch(
        `${this.getBackendUrl()}/api/v1/sms/conversation/phone-${phoneNumber}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result: GetSMSMessagesResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch SMS messages');
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching SMS messages by phone number:', error);
      throw error;
    }
  }

  /**
   * Format phone number for Twilio (ensure it starts with +)
   */
  static formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add + if not present and number doesn't start with country code
    if (cleaned.length === 10) {
      return `+1${cleaned}`; // Assume US number
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('+')) {
      return phoneNumber;
    } else {
      return `+${cleaned}`;
    }
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Basic validation - should start with + and have 10-15 digits
    return /^\+\d{10,15}$/.test(formatted);
  }

  /**
   * Get user's Twilio phone number for sending SMS
   */
  static async getUserPhoneNumber(): Promise<string | null> {
    try {
      const credentials = await getActiveTwilioCredentials();
      if (!credentials) {
        return null;
      }

      // In a real implementation, you might want to store the user's phone number
      // in the database or fetch it from Twilio
      // For now, we'll return null and let the user specify
      return null;
    } catch (error) {
      console.error('Error getting user phone number:', error);
      return null;
    }
  }
}

// Export convenience functions
export const sendSMS = (request: SendSMSRequest) => SMSService.sendSMS(request);
export const getSMSMessages = (conversationId: string) => SMSService.getSMSMessages(conversationId);
export const getSMSMessagesByPhoneNumber = (phoneNumber: string) => SMSService.getSMSMessagesByPhoneNumber(phoneNumber);
export const formatPhoneNumber = (phoneNumber: string) => SMSService.formatPhoneNumber(phoneNumber);
export const isValidPhoneNumber = (phoneNumber: string) => SMSService.isValidPhoneNumber(phoneNumber);
export const getUserPhoneNumber = () => SMSService.getUserPhoneNumber();

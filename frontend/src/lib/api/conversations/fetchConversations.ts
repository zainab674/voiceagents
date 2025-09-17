import { Conversation, ConversationsData } from '@/types/conversations';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export async function fetchConversations(): Promise<ConversationsData> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Build URL
    const url = new URL(`${API_BASE_URL}/api/v1/calls/history`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the data to match our Conversation interface
    const conversations: Conversation[] = data.conversations?.map((conv: any) => ({
      id: conv.id || conv.phoneNumber,
      contactId: conv.contactId || conv.phoneNumber,
      phoneNumber: conv.phoneNumber,
      firstName: conv.firstName,
      lastName: conv.lastName,
      displayName: conv.displayName || `${conv.firstName || ''} ${conv.lastName || ''}`.trim() || conv.phoneNumber,
      totalCalls: conv.totalCalls || conv.calls?.length || 0,
      totalSMS: conv.totalSMS || 0,
      lastActivityDate: conv.lastActivityDate || conv.lastCallDate || new Date().toISOString().split('T')[0],
      lastActivityTime: conv.lastActivityTime || conv.lastCallTime || new Date().toTimeString().split(' ')[0],
      lastActivityTimestamp: new Date(conv.lastActivityTimestamp || conv.lastCallTimestamp || Date.now()),
      lastCallOutcome: conv.lastCallOutcome,
      calls: conv.calls || [],
      smsMessages: conv.smsMessages || [],
      totalDuration: conv.totalDuration || '0:00',
      outcomes: {
        appointments: conv.outcomes?.appointments || 0,
        qualified: conv.outcomes?.qualified || 0,
        notQualified: conv.outcomes?.notQualified || 0,
        spam: conv.outcomes?.spam || 0
      }
    })) || [];

    return {
      conversations,
      total: conversations.length
    };
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

export async function fetchConversationById(conversationId: string): Promise<Conversation | null> {
  try {
    const conversations = await fetchConversations();
    return conversations.conversations.find(conv => conv.id === conversationId) || null;
  } catch (error) {
    console.error('Error fetching conversation by ID:', error);
    return null;
  }
}

export async function fetchConversationByPhoneNumber(phoneNumber: string): Promise<Conversation | null> {
  try {
    const conversations = await fetchConversations();
    return conversations.conversations.find(conv => conv.phoneNumber === phoneNumber) || null;
  } catch (error) {
    console.error('Error fetching conversation by phone number:', error);
    return null;
  }
}
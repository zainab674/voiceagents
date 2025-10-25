// types/conversations.ts
import { Call } from './calls';
import { SMSMessage } from '@/lib/api/sms/smsService';

export interface Conversation {
  id: string;
  contactId: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  totalCalls: number;
  totalSMS?: number;
  lastActivityDate: string;
  lastActivityTime: string;
  lastActivityTimestamp: Date;
  lastCallOutcome?: string;
  calls: Call[];
  smsMessages?: SMSMessage[];
  totalDuration: string;
  hasNewMessages?: boolean;
  outcomes: {
    appointments: number;
    qualified: number;
    notQualified: number;
    spam: number;
  };
}

export interface ConversationsData {
  conversations: Conversation[];
  total: number;
}

export interface ConversationMessage {
  id: string;
  type: 'call' | 'transcription' | 'sms';
  timestamp: Date;
  direction: string;
  duration: string;
  status: string;
  resolution?: string;
  summary?: string;
  recording?: string;
  transcript?: ConversationTranscript[];
  date: string;
  time: string;
  isLive?: boolean;
  confidence?: number;
  call_sid?: string;
  recording_info?: any;
  smsData?: SMSMessage;
  associatedAgent?: {
    id: string;
    name: string;
    description: string;
  };
}

export interface ConversationTranscript {
  speaker: string;
  time: string;
  text: string;
}


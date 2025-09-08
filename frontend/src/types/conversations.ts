// types/conversations.ts
import { Call } from './calls';

export interface Conversation {
  id: string;
  contactId: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  totalCalls: number;
  lastActivityDate: string;
  lastActivityTime: string;
  lastActivityTimestamp: Date;
  lastCallOutcome?: string;
  calls: Call[];
  totalDuration: string;
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
  type: 'call' | 'transcription';
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
}

export interface ConversationTranscript {
  speaker: string;
  time: string;
  text: string;
}


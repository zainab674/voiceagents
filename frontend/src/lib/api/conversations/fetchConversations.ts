// lib/api/conversations/fetchConversations.ts
import { Conversation, ConversationsData } from '@/types/conversations';
import { Call } from '@/types/calls';
import { supabase } from '@/lib/supabase';
import { fetchRecordingUrlCached, RecordingInfo } from '../recordings/fetchRecordingUrl';

export interface CallHistoryRecord {
  id: string;
  call_id: string;
  assistant_id: string;
  phone_number: string;
  participant_identity: string;
  start_time: string;
  end_time: string;
  call_duration: number;
  call_status: string;
  transcription: Array<{ role: string; content: any }>;
  call_sid?: string;
  recording_sid?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch conversations from call_history table
 */
export const fetchConversations = async (): Promise<ConversationsData> => {
  try {
    // Get the current session token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/v1/calls/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.calls) {
      return {
        conversations: [],
        total: 0
      };
    }

    // Group calls by phone number to create conversations
    const conversationsMap = new Map<string, Conversation>();

    // Process calls with async recording fetches
    const processedCalls = await Promise.all(
      data.data.calls.map(async (call: any) => {
        try {
          const phoneNumber = call.contact_phone || 'Unknown';
          const participantName = call.contact_name || 'Unknown Contact';

          // Process transcription data if available
          const processedTranscript = [];
          if (call.transcription && Array.isArray(call.transcription)) {
            call.transcription.forEach((item: any) => {
              if (item.role && item.content) {
                processedTranscript.push({
                  speaker: item.role === 'user' ? 'Customer' : item.role === 'assistant' ? 'Agent' : item.role,
                  time: formatTime(new Date(call.started_at || call.created_at)),
                  text: typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
                });
              }
            });
          }

          // Fetch recording info if call_sid exists
          const recordingInfo = call.call_sid ? await fetchRecordingUrlCached(call.call_sid) : null;

          // Add call to conversation
          const callData: Call = {
            id: call.id,
            name: participantName,
            phoneNumber: phoneNumber,
            date: formatDate(new Date(call.started_at || call.created_at)),
            time: formatTime(new Date(call.started_at || call.created_at)),
            duration: formatDuration(call.duration_seconds || 0),
            direction: 'inbound' as const,
            channel: 'voice' as const,
            tags: [],
            status: call.status,
            resolution: determineCallResolution(call.status, call.outcome),
            call_recording: recordingInfo?.recordingUrl || '',
            summary: call.notes || generateCallSummary(processedTranscript),
            transcript: processedTranscript,
            analysis: null,
            address: '',
            messages: [],
            phone_number: phoneNumber,
            call_outcome: determineCallResolution(call.status, call.outcome),
            created_at: call.started_at || call.created_at,
            call_sid: call.call_sid || call.id,
            recording_info: recordingInfo
          };

          return { callData, phoneNumber, participantName };
        } catch (error) {
          console.error('Error processing call:', call.id, error);
          return null;
        }
      })
    );

    // Filter out failed calls and group by phone number
    processedCalls
      .filter(Boolean)
      .forEach(({ callData, phoneNumber, participantName }) => {
        if (!conversationsMap.has(phoneNumber)) {
          // Create new conversation
          const conversation: Conversation = {
            id: `conv_${phoneNumber}`,
            contactId: `contact_${phoneNumber}`,
            phoneNumber: phoneNumber,
            firstName: participantName.split(' ')[0] || 'Unknown',
            lastName: participantName.split(' ').slice(1).join(' ') || '',
            displayName: participantName,
            totalCalls: 0,
            lastActivityDate: '',
            lastActivityTime: '',
            lastActivityTimestamp: new Date(),
            lastCallOutcome: undefined,
            calls: [],
            totalDuration: '0:00',
            outcomes: {
              appointments: 0,
              qualified: 0,
              notQualified: 0,
              spam: 0
            }
          };
          conversationsMap.set(phoneNumber, conversation);
        }

        const conversation = conversationsMap.get(phoneNumber)!;
        conversation.calls.push(callData);
        conversation.totalCalls += 1;

        // Update last activity
        const callTime = new Date(callData.created_at);
        if (callTime > conversation.lastActivityTimestamp) {
          conversation.lastActivityDate = callData.date;
          conversation.lastActivityTime = callData.time;
          conversation.lastActivityTimestamp = callTime;
          conversation.lastCallOutcome = callData.resolution;
        }

        // Update outcomes
        if (callData.resolution) {
          const resolution = callData.resolution.toLowerCase();
          if (resolution.includes('appointment') || resolution.includes('booked')) {
            conversation.outcomes.appointments += 1;
          } else if (resolution.includes('qualified') && !resolution.includes('not')) {
            conversation.outcomes.qualified += 1;
          } else if (resolution.includes('not qualified') || resolution.includes('not eligible')) {
            conversation.outcomes.notQualified += 1;
          } else if (resolution.includes('spam')) {
            conversation.outcomes.spam += 1;
          }
        }

        // Update total duration
        conversation.totalDuration = calculateTotalDuration(conversation.calls);
      });

    // Convert map to array and sort by last activity
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => b.lastActivityTimestamp.getTime() - a.lastActivityTimestamp.getTime());

    return {
      conversations,
      total: conversations.length
    };

  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

/**
 * Format duration in seconds to MM:SS format
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format date to YYYY-MM-DD format
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format time to HH:MM format
 */
function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0].substring(0, 5);
}

/**
 * Calculate total duration for all calls in a conversation
 */
function calculateTotalDuration(calls: Call[]): string {
  const totalSeconds = calls.reduce((total, call) => {
    const [minutes, seconds] = call.duration.split(':').map(Number);
    return total + (minutes * 60) + seconds;
  }, 0);

  return formatDuration(totalSeconds);
}

/**
 * Determine call resolution based on status and outcome
 */
function determineCallResolution(status: string, outcome?: string): string {
  if (outcome) {
    return outcome;
  }
  
  if (status === 'spam') return 'Spam';
  if (status === 'failed') return 'Call Dropped';
  if (status === 'no_response') return 'No Response';
  if (status === 'completed') return 'Completed';
  
  return status === 'completed' ? 'Completed' : 'Call Dropped';
}

/**
 * Generate call summary from transcription
 */
function generateCallSummary(transcription: Array<{ speaker: string; text: string }>): string {
  if (!transcription || transcription.length === 0) {
    return 'No conversation recorded';
  }

  // Extract key points from transcription
  const customerMessages = transcription
    .filter(t => t.speaker === 'Customer')
    .map(t => t.text)
    .join(' ');

  const agentMessages = transcription
    .filter(t => t.speaker === 'Agent')
    .map(t => t.text)
    .join(' ');

  // Create a brief summary
  const summary = [];

  if (customerMessages.includes('appointment') || customerMessages.includes('schedule')) {
    summary.push('Customer interested in scheduling appointment');
  }

  if (customerMessages.includes('window') || customerMessages.includes('replacement')) {
    summary.push('Customer inquired about window replacement services');
  }

  if (agentMessages.includes('appointment') || agentMessages.includes('schedule')) {
    summary.push('Agent provided scheduling information');
  }

  if (agentMessages.includes('consultation') || agentMessages.includes('measure')) {
    summary.push('Agent offered free consultation');
  }

  return summary.length > 0 ? summary.join('. ') + '.' : 'General inquiry about services';
}

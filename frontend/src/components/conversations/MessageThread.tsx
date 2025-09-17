// components/conversations/MessageThread.tsx
import React, { useState, useEffect } from "react";
import { Conversation, ConversationMessage } from "@/types/conversations";
import { format, isSameDay } from "date-fns";
import { MessageBubble } from "./MessageBubble";
import { SMSInput } from "./SMSInput";
import { ConversationAgentFilter } from "./ConversationAgentFilter";
import { getSMSMessagesByPhoneNumber } from "@/lib/api/sms/smsService";

interface MessageThreadProps {
  conversation: Conversation;
}

export function MessageThread({ conversation }: MessageThreadProps) {
  const [showTranscription, setShowTranscription] = useState(false);
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [loadingSMS, setLoadingSMS] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");

  // Debug conversation data
  React.useEffect(() => {
    console.log('MessageThread conversation:', conversation);
  }, [conversation]);

  const refreshSMSMessages = async () => {
    if (!conversation.phoneNumber) return;
    
    console.log('Loading SMS messages for phone:', conversation.phoneNumber);
    setLoadingSMS(true);
    try {
      const messages = await getSMSMessagesByPhoneNumber(conversation.phoneNumber);
      console.log('SMS messages loaded:', messages);
      setSmsMessages(messages);
    } catch (error) {
      console.error('Error loading SMS messages:', error);
    } finally {
      setLoadingSMS(false);
    }
  };

  // Load SMS messages for this conversation
  useEffect(() => {
    refreshSMSMessages();
  }, [conversation.phoneNumber]);

  // Extract unique agents from conversation calls
  const availableAgents = React.useMemo(() => {
    console.log('Conversation calls:', conversation.calls);
    const agentMap = new Map();
    conversation.calls.forEach(call => {
      console.log('Call agents:', call.agents);
      if (call.agents && call.agents.id) {
        agentMap.set(call.agents.id, {
          id: call.agents.id,
          name: call.agents.name,
          description: call.agents.description
        });
      }
    });
    const agents = Array.from(agentMap.values());
    console.log('Available agents:', agents);
    return agents;
  }, [conversation.calls]);

  // Handle agent filter change
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Convert calls to messages with proper grouping
  const callMessages: ConversationMessage[] = conversation.calls
    .filter(call => {
      // Apply agent filter
      if (selectedAgentId === "all") return true;
      return call.agents && call.agents.id === selectedAgentId;
    })
    .map(call => {
      // Create a valid timestamp from the call data
      const timestamp = call.started_at ? new Date(call.started_at) : 
                       call.created_at ? new Date(call.created_at) : 
                       new Date();
      
      return {
        id: call.id,
        type: 'call' as const,
        timestamp: timestamp,
        direction: call.direction || 'outbound',
        duration: call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00',
        status: call.status || 'completed',
        resolution: call.outcome,
        summary: call.notes,
        recording: call.call_sid,
        transcript: call.transcription || [],
        date: timestamp.toISOString().split('T')[0],
        time: timestamp.toTimeString().split(' ')[0].substring(0, 5),
        call_sid: call.call_sid,
        recording_info: null
      };
    });

  // Convert SMS messages to message format
  const smsMessagesFormatted: ConversationMessage[] = smsMessages.map(sms => {
    console.log('Converting SMS message:', sms);
    const timestamp = sms.dateCreated ? new Date(sms.dateCreated) : new Date();
    const formatted = {
      id: sms.messageSid,
      type: 'sms' as const,
      timestamp: timestamp,
      direction: sms.direction,
      duration: '0:00',
      status: sms.status,
      resolution: undefined,
      summary: undefined,
      recording: undefined,
      transcript: [{
        speaker: sms.direction === 'inbound' ? 'Customer' : 'Agent',
        time: timestamp.toTimeString().split(' ')[0].substring(0, 5),
        text: sms.body
      }],
      date: timestamp.toISOString().split('T')[0],
      time: timestamp.toTimeString().split(' ')[0].substring(0, 5),
      smsData: sms
    };
    console.log('Formatted SMS message:', formatted);
    return formatted;
  });

  // Combine and sort all messages by timestamp
  console.log('Call messages:', callMessages.length);
  console.log('SMS messages formatted:', smsMessagesFormatted.length);
  const messages: ConversationMessage[] = [...callMessages, ...smsMessagesFormatted]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  console.log('Total messages:', messages.length);

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    try {
      const dateKey = format(message.timestamp, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    } catch (error) {
      console.warn('Invalid timestamp for message:', message.id, message.timestamp);
      // Use a fallback date key
      const fallbackKey = 'unknown-date';
      if (!groups[fallbackKey]) {
        groups[fallbackKey] = [];
      }
      groups[fallbackKey].push(message);
    }
    return groups;
  }, {} as Record<string, ConversationMessage[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Thread Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
                {getInitials(conversation.displayName)}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">
                {conversation.displayName}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {conversation.phoneNumber}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                {callMessages.length} call{callMessages.length !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {smsMessages.length} SMS
              </span>
              {availableAgents.length > 0 && (
                <ConversationAgentFilter
                  agents={availableAgents}
                  selectedAgentId={selectedAgentId}
                  onAgentChange={handleAgentChange}
                />
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${showTranscription
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              onClick={() => setShowTranscription(!showTranscription)}
            >

            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">

        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-4">
            {Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
              <div key={dateKey} className="space-y-2">
                {/* Date Separator */}
                <div className="flex items-center justify-center">
                  <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-500 dark:text-gray-400">
                    {dateKey === 'unknown-date' ? 'Unknown Date' : 
                     (() => {
                       try {
                         return format(new Date(dateKey), 'MMM d, yyyy');
                       } catch (error) {
                         return dateKey;
                       }
                     })()}
                  </div>
                </div>

                {/* Messages for this day */}
                {dayMessages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    conversation={conversation}
                    showAvatar={index === 0 || dayMessages[index - 1]?.direction !== message.direction}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* SMS Input */}
        <SMSInput 
          conversation={conversation} 
          onMessageSent={refreshSMSMessages}
        />
      </div>
    </div>
  );
}

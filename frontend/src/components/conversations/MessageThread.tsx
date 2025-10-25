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
  const [selectedView, setSelectedView] = useState<'calls' | 'sms'>('calls');

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

  // Debug conversation data
  React.useEffect(() => {
    console.log('MessageThread conversation:', conversation);
    console.log('Available agents for filtering:', availableAgents);
  }, [conversation, availableAgents]);

  // Debug SMS messages state changes
  React.useEffect(() => {
    console.log('SMS messages state changed:', smsMessages.length, 'messages');
  }, [smsMessages]);

  // Debug view and filter state changes
  React.useEffect(() => {
    console.log('View/Filter state changed:', { selectedView, selectedAgentId });
  }, [selectedView, selectedAgentId]);

  // Handle agent filter change
  const handleAgentChange = (agentId: string) => {
    console.log('Agent filter changed to:', agentId);
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
      const matches = call.agents && call.agents.id === selectedAgentId;
      console.log('Filtering call:', { callId: call.id, agentId: call.agents?.id, selectedAgentId, matches });
      return matches;
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
        transcript: call.transcription ? call.transcription.map((item: any) => ({
          speaker: item.role === 'assistant' ? 'Assistant' : 'Customer',
          time: '12:00', // Default time since we don't have timestamp in transcript
          text: Array.isArray(item.content) ? item.content.join(' ') : item.content
        })) : [],
        date: timestamp.toISOString().split('T')[0],
        time: timestamp.toTimeString().split(' ')[0].substring(0, 5),
        call_sid: call.call_sid,
        recording_info: null,
        associatedAgent: call.agents
      };
    });

  // Convert SMS messages to message format
  const smsMessagesFormatted: ConversationMessage[] = smsMessages.map(sms => {
    console.log('Converting SMS message:', sms);
    const timestamp = sms.dateCreated ? new Date(sms.dateCreated) : new Date();
    
    // Find the most relevant agent for this SMS
    // Strategy: Find the agent from the call closest in time to this SMS (before or after)
    let associatedAgent = null;
    
    if (conversation.calls.length > 0) {
      // Get all calls with agents
      const callsWithAgents = conversation.calls.filter(call => call.agents && call.agents.id);
      
      if (callsWithAgents.length > 0) {
        // Find the call closest in time to this SMS
        let closestCall = callsWithAgents[0];
        let minTimeDiff = Math.abs(new Date(closestCall.started_at || closestCall.created_at || 0).getTime() - timestamp.getTime());
        
        for (const call of callsWithAgents) {
          const callTime = new Date(call.started_at || call.created_at || 0);
          const timeDiff = Math.abs(callTime.getTime() - timestamp.getTime());
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestCall = call;
          }
        }
        
        // Associate with the closest call agent, but extend the time window to 7 days
        // This ensures more SMS messages get associated with agents for filtering
        const maxTimeDiff = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        if (minTimeDiff <= maxTimeDiff) {
          associatedAgent = closestCall.agents;
        } else {
          // If no call is within 7 days, use the most recent agent as fallback
          // This ensures SMS messages can still be filtered by agents
          const mostRecentCall = callsWithAgents.reduce((latest, current) => {
            const latestTime = new Date(latest.started_at || latest.created_at || 0);
            const currentTime = new Date(current.started_at || current.created_at || 0);
            return currentTime > latestTime ? current : latest;
          });
          associatedAgent = mostRecentCall.agents;
        }
      }
    }
    
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
      smsData: sms,
      // Associate SMS with the closest agent in time
      associatedAgent: associatedAgent
    };
    console.log('Formatted SMS message:', formatted, 'associatedAgent:', associatedAgent);
    return formatted;
  });

  // Combine and sort all messages by timestamp, filtered by selected view
  console.log('Call messages:', callMessages.length);
  console.log('SMS messages formatted:', smsMessagesFormatted.length);
  console.log('SMS messages with agents:', smsMessagesFormatted.filter(sms => sms.associatedAgent).length);
  console.log('SMS messages without agents:', smsMessagesFormatted.filter(sms => !sms.associatedAgent).length);
  const allMessages: ConversationMessage[] = [...callMessages, ...smsMessagesFormatted]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Filter messages based on selected view and agent
  console.log('Starting filter process:', { selectedView, selectedAgentId, totalMessages: allMessages.length });
  const messages: ConversationMessage[] = allMessages.filter(message => {
    console.log('Filtering message:', { id: message.id, type: message.type, agentId: message.associatedAgent?.id });
    
    // First filter by view type
    if (selectedView === 'calls') {
      if (message.type !== 'call') {
        console.log('Filtered out - not a call');
        return false;
      }
    } else if (selectedView === 'sms') {
      if (message.type !== 'sms') {
        console.log('Filtered out - not an SMS');
        return false;
      }
    }
    
    // Then filter by agent (if not "all")
    if (selectedAgentId !== "all") {
      if (message.type === 'call') {
        const matches = message.associatedAgent?.id === selectedAgentId;
        console.log('Filtering call by agent:', { messageId: message.id, agentId: message.associatedAgent?.id, selectedAgentId, matches });
        return matches;
      } else if (message.type === 'sms') {
        // For SMS messages, show if there's an agent match
        // If no agent is associated with the SMS, don't show it when filtering by specific agent
        const matches = message.associatedAgent?.id === selectedAgentId;
        console.log('Filtering SMS by agent:', { messageId: message.id, agentId: message.associatedAgent?.id, selectedAgentId, matches, hasAgent: !!message.associatedAgent });
        return matches;
      }
    }
    
    console.log('Message passed all filters');
    return true; // Show all if no specific view or agent selected
  });
  
  console.log('Total messages after filtering:', messages.length);
  console.log('Filtered SMS messages:', messages.filter(m => m.type === 'sms').length);
  console.log('Filtered call messages:', messages.filter(m => m.type === 'call').length);
  
  // Debug: Show how many SMS messages were filtered out due to agent filtering
  if (selectedAgentId !== "all" && selectedView === 'sms') {
    const totalSMS = smsMessagesFormatted.length;
    const filteredSMS = messages.filter(m => m.type === 'sms').length;
    const filteredOutSMS = totalSMS - filteredSMS;
    console.log(`SMS Agent Filter Debug: ${filteredOutSMS} SMS messages filtered out (${totalSMS} total, ${filteredSMS} shown)`);
  }

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
              <button
                onClick={() => {
                  console.log('Calls button clicked, switching to calls view');
                  setSelectedView('calls');
                }}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  selectedView === 'calls'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {callMessages.length} call{callMessages.length !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => {
                  console.log('SMS button clicked, switching to SMS view');
                  setSelectedView('sms');
                }}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  selectedView === 'sms'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={selectedAgentId !== "all" ? 
                  `${messages.filter(m => m.type === 'sms').length} SMS for selected agent (${smsMessagesFormatted.length} total)` : 
                  `${smsMessagesFormatted.length} SMS messages`
                }
              >
                {smsMessagesFormatted.length} SMS
              </button>
              {availableAgents.length > 0 ? (
                <ConversationAgentFilter
                  agents={availableAgents}
                  selectedAgentId={selectedAgentId}
                  onAgentChange={handleAgentChange}
                />
              ) : (
                <div className="text-xs text-gray-500">No agents found</div>
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
            {/* Show message when SMS messages are filtered out due to agent filtering */}
            {selectedAgentId !== "all" && selectedView === 'sms' && messages.length === 0 && smsMessagesFormatted.length > 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-sm">
                  No SMS messages found for the selected agent.
                  <br />
                  <span className="text-xs">
                    SMS messages are associated with agents based on nearby calls. 
                    Try selecting "All Agents" to see all SMS messages.
                  </span>
                </div>
              </div>
            )}
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

// components/conversations/MessageThread.tsx
import React, { useState } from "react";
import { Conversation, ConversationMessage } from "@/types/conversations";
import { format, isSameDay } from "date-fns";
import { MessageBubble } from "./MessageBubble";

interface MessageThreadProps {
  conversation: Conversation;
}

export function MessageThread({ conversation }: MessageThreadProps) {
  const [showTranscription, setShowTranscription] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Convert calls to messages with proper grouping
  const messages: ConversationMessage[] = conversation.calls.map(call => ({
    id: call.id,
    type: 'call' as const,
    timestamp: new Date(`${call.date}T${call.time}`),
    direction: call.direction,
    duration: call.duration,
    status: call.status,
    resolution: call.resolution,
    summary: call.summary,
    recording: call.call_recording,
    transcript: call.transcript,
    date: call.date,
    time: call.time,
    call_sid: call.call_sid,
    recording_info: call.recording_info
  })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const dateKey = format(message.timestamp, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {conversation.totalCalls} call{conversation.totalCalls !== 1 ? 's' : ''}
            </span>
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
                    {format(new Date(dateKey), 'MMM d, yyyy')}
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

        {/* Message Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

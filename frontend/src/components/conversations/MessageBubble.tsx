// components/conversations/MessageBubble.tsx
import React from "react";
import { Conversation, ConversationMessage } from "@/types/conversations";
import { format } from "date-fns";
import { CallRecordingDisplay } from "./CallRecordingDisplay";

interface MessageBubbleProps {
  message: ConversationMessage;
  conversation: Conversation;
  showAvatar?: boolean;
}

export function MessageBubble({ message, conversation, showAvatar = true }: MessageBubbleProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getOutcomeBadgeColor = (outcome?: string) => {
    if (!outcome) return "secondary";
    const normalized = outcome.toLowerCase();

    if (normalized.includes('appointment') || normalized.includes('booked')) {
      return "default";
    } else if (normalized.includes('qualified') && !normalized.includes('not')) {
      return "secondary";
    } else if (normalized.includes('spam')) {
      return "destructive";
    } else if (normalized.includes('not qualified') || normalized.includes('not eligible')) {
      return "outline";
    }
    return "secondary";
  };

  const isIncoming = message.direction === 'inbound';
  const isLiveTranscription = message.type === 'transcription' && message.isLive;

  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} space-x-2`}>
      {isIncoming && showAvatar && (
        <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
            {getInitials(conversation.displayName)}
          </span>
        </div>
      )}
      {isIncoming && !showAvatar && (
        <div className="w-6" />
      )}

      <div className={`max-w-sm ${!isIncoming ? 'ml-auto' : ''}`}>
        <div
          className={`px-3 py-2 rounded-xl transition-all duration-200 ${isLiveTranscription
            ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            : isIncoming
              ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
            }`}
        >
          {/* Call Header */}
          <div className="flex items-center space-x-2 mb-1">
            {message.type === 'transcription' ? (
              <>
                <span className="text-xs">🎤</span>
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  Live Transcription
                </span>
                {isLiveTranscription && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 ml-auto animate-pulse">
                    Live
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-xs">📞</span>
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  {isIncoming ? 'Incoming' : 'Outgoing'} Call
                </span>

              </>
            )}
          </div>

          {/* Call Details */}
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
            {message.type === 'transcription' ? (
              <>
                <div className="flex items-center space-x-1">
                  <span>🕐</span>
                  <span>{message.time}</span>
                </div>

              </>
            ) : (
              <>
                <div className="flex items-center space-x-1">
                  <span>🕐</span>
                  <span>{message.duration}</span>
                </div>
                <span>•</span>
                <span>{message.status}</span>
              </>
            )}
          </div>



          {/* Live Transcription Text */}
          {message.type === 'transcription' && message.transcript && (
            <div className="text-xs text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">
              {message.transcript.map((entry, idx) => (
                <div key={idx} className="mb-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {entry.speaker}:
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">
                    {entry.text}
                    {isLiveTranscription && idx === message.transcript!.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recording */}
          {message.type === 'call' && (
            <CallRecordingDisplay
              call={{
                call_sid: message.call_sid,
                call_recording: message.recording,
                recording_info: message.recording_info
              }}
              conversationName={conversation.displayName}
            />
          )}

          {/* Transcript */}
          {message.transcript && message.type === 'call' && (
            <div className="mt-2">
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  View Transcript
                </summary>
                <div className="mt-2 space-y-1">
                  {message.transcript.map((entry, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {entry.speaker}:
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 ml-1">
                        {entry.text}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${!isIncoming ? 'text-right' : ''}`}>
          {format(message.timestamp, 'h:mm a')}
        </div>
      </div>

      {!isIncoming && showAvatar && (
        <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-white">
            ME
          </span>
        </div>
      )}
      {!isIncoming && !showAvatar && (
        <div className="w-6" />
      )}
    </div>
  );
}


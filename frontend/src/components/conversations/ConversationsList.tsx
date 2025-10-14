// components/conversations/ConversationsList.tsx
import React from "react";
import { Conversation } from "@/types/conversations";

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
}

export function ConversationsList({
  conversations,
  selectedConversationId,
  onSelectConversation
}: ConversationsListProps) {

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        {/* Conversation Count */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {conversations.length} conversations
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                selectedConversationId === conversation.id 
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700" 
                  : "hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {getInitials(conversation.displayName)}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {conversation.displayName}
                      </h3>
                      {conversation.hasNewMessages && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                      {conversation.lastActivityTime}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {conversation.phoneNumber}
                    </p>
                    
                    {conversation.lastCallOutcome && (
                      <div className={`w-1.5 h-1.5 rounded-full ml-2 ${
                        getOutcomeBadgeColor(conversation.lastCallOutcome) === 'default' && "bg-green-500",
                        getOutcomeBadgeColor(conversation.lastCallOutcome) === 'secondary' && "bg-blue-500",
                        getOutcomeBadgeColor(conversation.lastCallOutcome) === 'destructive' && "bg-red-500",
                        getOutcomeBadgeColor(conversation.lastCallOutcome) === 'outline' && "bg-gray-400"
                      }`} />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {conversation.totalCalls} calls • {conversation.totalSMS || 0} SMS • {conversation.totalDuration}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {conversations.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <div className="text-sm font-medium mb-1">No conversations found</div>
            <p className="text-xs">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}


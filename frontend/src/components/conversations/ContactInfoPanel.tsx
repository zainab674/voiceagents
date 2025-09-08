// components/conversations/ContactInfoPanel.tsx
import React from "react";
import { Conversation } from "@/types/conversations";
import { formatDistanceToNow } from "date-fns";

interface ContactInfoPanelProps {
  conversation: Conversation;
}

export function ContactInfoPanel({ conversation }: ContactInfoPanelProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-xl font-medium text-gray-600 dark:text-gray-300">
                {getInitials(conversation.displayName)}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {conversation.displayName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conversation.phoneNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Calls</div>
                <div className="text-base font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {conversation.totalCalls}
                </div>
              </div>

            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Contact Details</h3>
            <div className="space-y-3">

              <div className="flex items-center space-x-3">
                <span className="text-gray-400">📞</span>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Phone</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{conversation.phoneNumber}</div>
                </div>
              </div>
            </div>
          </div>



          {/* Notes Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Notes</h3>
              <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Add Note
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 text-center">
              No notes yet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// pages/Conversations.tsx
import React, { useState, useEffect } from "react";
import { Conversation } from "@/types/conversations";
import { fetchConversations } from "@/lib/api/conversations/fetchConversations";
import { ConversationsList } from "@/components/conversations/ConversationsList";
import { MessageThread } from "@/components/conversations/MessageThread";
import { ContactInfoPanel } from "@/components/conversations/ContactInfoPanel";
import ConversationsToolbar from "@/components/conversations/ConversationsToolbar";
import { useConversationsFilter } from "@/components/conversations/hooks/useConversationsFilter";

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real conversations data
  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchConversations();
      setConversations(response.conversations);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Use conversations filter hook with real data
  const {
    searchQuery,
    setSearchQuery,
    resolutionFilter,
    setResolutionFilter,
    dateRange,
    setDateRange,
    conversations: filteredConversations,
    filteredCount
  } = useConversationsFilter(conversations);

  // Auto-select first conversation on load
  useEffect(() => {
    if (filteredConversations.length > 0 && !selectedConversation) {
      setSelectedConversation(filteredConversations[0]);
    }
  }, [filteredConversations, selectedConversation]);

  // Reset selected conversation if it's no longer in filtered results
  useEffect(() => {
    if (selectedConversation && !filteredConversations.find(c => c.id === selectedConversation.id)) {
      setSelectedConversation(filteredConversations.length > 0 ? filteredConversations[0] : null);
    }
  }, [filteredConversations, selectedConversation]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="py-8">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Loading conversations...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="py-8">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-red-500 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error Loading Conversations</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="py-8">
            {/* Header */}
            <div className="flex flex-col space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <h1 className="text-4xl font-light tracking-tight text-gray-900 dark:text-gray-100">
                  Conversations
                </h1>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadConversations}
                    disabled={isLoading}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>

            </div>

            {/* Conversations Toolbar */}
            <ConversationsToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resolutionFilter={resolutionFilter}
              onResolutionChange={setResolutionFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Unified Three-Panel Layout */}
            {filteredConversations.length === 0 ? (
              <div className="h-[calc(100vh-8rem)] flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Conversations Found</h3>
                  <p className="mb-4">
                    {conversations.length === 0
                      ? "No conversations have been recorded yet. Conversations will appear here when calls are made."
                      : "No conversations match your current filters. Try adjusting your search or date range."
                    }
                  </p>
                  {conversations.length === 0 && (
                    <button
                      onClick={loadConversations}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Refresh
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[calc(100vh-8rem)] flex rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Left Panel - Conversations List */}
                <div className="w-72 flex flex-col border-r border-gray-200 dark:border-gray-700">
                  <ConversationsList
                    conversations={filteredConversations}
                    selectedConversationId={selectedConversation?.id}
                    onSelectConversation={handleSelectConversation}
                  />
                </div>

                {/* Middle Panel - Message Thread */}
                <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
                  {selectedConversation ? (
                    <MessageThread conversation={selectedConversation} />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <div className="text-lg font-medium mb-2">
                          Select a conversation
                        </div>
                        <p>
                          Choose a conversation from the list to start messaging
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Panel - Contact Info */}
                <div className="w-72 flex flex-col">
                  {selectedConversation ? (
                    <ContactInfoPanel conversation={selectedConversation} />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <div className="text-lg font-medium mb-2">
                          Contact Details
                        </div>
                        <p className="text-sm">
                          Select a conversation to view contact information
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


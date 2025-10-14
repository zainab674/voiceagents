// pages/Conversations.tsx
import React, { useState, useEffect, useRef } from "react";
import { Conversation } from "@/types/conversations";
import { fetchConversations } from "@/lib/api/conversations/fetchConversations";
import { ConversationsList } from "@/components/conversations/ConversationsList";
import { MessageThread } from "@/components/conversations/MessageThread";
import { ContactInfoPanel } from "@/components/conversations/ContactInfoPanel";

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef(true);
  const [lastMessageTimestamps, setLastMessageTimestamps] = useState<Record<string, string>>({});

  // Check for new messages since last timestamp
  const checkForNewMessages = async (phoneNumber: string) => {
    const lastTimestamp = lastMessageTimestamps[phoneNumber];
    if (!lastTimestamp) {
      console.log(`No previous timestamp for ${phoneNumber}, skipping new message check`);
      return;
    }

    try {
      console.log(`🔄 Checking for new messages for ${phoneNumber} since ${lastTimestamp}`);
      const response = await fetchConversations();
      const conversation = response.conversations.find(conv => conv.phoneNumber === phoneNumber);
      
      if (conversation) {
        // Check if there are new messages by comparing timestamps
        const allMessages = [
          ...(conversation.smsMessages || []).map(sms => ({ timestamp: sms.dateCreated, type: 'sms' })),
          ...conversation.calls.map(call => ({ timestamp: call.created_at, type: 'call' }))
        ];
        
        const newMessages = allMessages.filter(msg => 
          new Date(msg.timestamp).getTime() > new Date(lastTimestamp).getTime()
        );
        
        if (newMessages.length > 0) {
          console.log(`📨 Found ${newMessages.length} new messages for ${phoneNumber}`);
          
          // Update the conversation with new messages
          setConversations(prevConversations => 
            prevConversations.map(conv => {
              if (conv.phoneNumber === phoneNumber) {
                return { ...conversation, hasNewMessages: true };
              }
              return conv;
            })
          );

          // Update the selected conversation if it's the one being updated
          if (selectedConversation?.phoneNumber === phoneNumber) {
            setSelectedConversation(prev => prev ? { ...conversation, hasNewMessages: true } : prev);
          }

          // Update the last timestamp
          const latestMessage = newMessages.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )[newMessages.length - 1];
          
          setLastMessageTimestamps(prev => ({
            ...prev,
            [phoneNumber]: latestMessage.timestamp
          }));
        }
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
  };

  // Fetch real conversations data
  const loadConversations = async (isPolling = false) => {
    try {
      if (!isPolling) {
        setIsLoading(true);
      }
      setError(null);
      const response = await fetchConversations();
      
      if (!isPolling) {
        setConversations(response.conversations);
        
        // Set initial timestamps for all conversations
        const timestamps: Record<string, string> = {};
        response.conversations.forEach(conv => {
          const allMessages = [
            ...(conv.smsMessages || []).map(sms => ({ timestamp: sms.dateCreated, type: 'sms' })),
            ...conv.calls.map(call => ({ timestamp: call.created_at, type: 'call' }))
          ];
          
          if (allMessages.length > 0) {
            const latestMessage = allMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )[allMessages.length - 1];
            
            timestamps[conv.phoneNumber] = latestMessage.timestamp;
          }
        });
        
        setLastMessageTimestamps(timestamps);
        setLastUpdateTime(new Date());
      } else {
        // For polling, check for new messages in selected conversation
        if (selectedConversation) {
          await checkForNewMessages(selectedConversation.phoneNumber);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      if (!isPolling) {
        setError('Failed to load conversations');
        setConversations([]);
      }
    } finally {
      if (!isPolling) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Start/stop polling based on page visibility
  useEffect(() => {
    // Start polling every 30 seconds to check for new messages
    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      console.log('🔄 Polling: Checking for new messages...', new Date().toLocaleTimeString());
      
      // Check for new messages in currently selected conversation
      if (selectedConversation) {
        await checkForNewMessages(selectedConversation.phoneNumber);
      }
      
      // Also refresh conversations list (lightweight)
      await loadConversations(true);
    }, 30000); // Poll every 30 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [selectedConversation]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      isPageVisibleRef.current = !document.hidden;

      // If page becomes visible and we haven't updated in a while, check for new messages
      if (!document.hidden && lastUpdateTime) {
        const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
        if (timeSinceLastUpdate > 30000) { // If more than 30 seconds since last update
          // Check for new messages in currently selected conversation
          if (selectedConversation) {
            await checkForNewMessages(selectedConversation.phoneNumber);
          }
          // Also refresh conversations list
          await loadConversations(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastUpdateTime, selectedConversation]);


  // Auto-select first conversation on load
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  // Reset selected conversation if it's no longer in conversations
  useEffect(() => {
    if (selectedConversation && !conversations.find(c => c.id === selectedConversation.id)) {
      setSelectedConversation(conversations.length > 0 ? conversations[0] : null);
    }
  }, [conversations, selectedConversation]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Clear new message flags for the selected conversation
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === conversation.id
          ? { ...conv, hasNewMessages: false }
          : conv
      )
    );
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
                  {isPolling && (
                    <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Live</span>
                    </div>
                  )}
                  <button
                    onClick={() => loadConversations()}
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


            {/* Unified Three-Panel Layout */}
            {conversations.length === 0 ? (
              <div className="h-[calc(100vh-8rem)] flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Conversations Found</h3>
                  <p className="mb-4">
                    No conversations have been recorded yet. Conversations will appear here when calls are made.
                  </p>
                  <button
                    onClick={() => loadConversations()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-[calc(100vh-8rem)] flex rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Left Panel - Conversations List */}
                <div className="w-72 flex flex-col border-r border-gray-200 dark:border-gray-700">
                  <ConversationsList
                    conversations={conversations}
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

             
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


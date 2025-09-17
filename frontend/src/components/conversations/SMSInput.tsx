import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, Phone } from "lucide-react";
import { Conversation } from "@/types/conversations";
import { sendSMS, formatPhoneNumber, isValidPhoneNumber } from "@/lib/api/sms/smsService";
import { useToast } from "@/hooks/use-toast";

interface SMSInputProps {
  conversation: Conversation;
  onMessageSent?: () => void;
}

export function SMSInput({ conversation, onMessageSent }: SMSInputProps) {
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageType, setMessageType] = useState<'sms' | 'call'>('sms');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;

    try {
      setIsSending(true);

      if (messageType === 'sms') {
        // Validate phone number
        if (!isValidPhoneNumber(conversation.phoneNumber)) {
          toast({
            title: "Invalid Phone Number",
            description: "Please check the phone number format.",
            variant: "destructive",
          });
          return;
        }

        // Send SMS
        const result = await sendSMS({
          to: formatPhoneNumber(conversation.phoneNumber),
          from: '', // Will be determined by backend
          body: message.trim(),
          conversationId: conversation.id
        });

        if (result.success) {
          toast({
            title: "SMS Sent",
            description: "Your message has been sent successfully.",
          });
          setMessage("");
          setIsExpanded(false);
          onMessageSent?.();
        } else {
          throw new Error(result.message || 'Failed to send SMS');
        }
      } else {
        // Handle call logic here
        console.log("Initiating call to:", conversation.phoneNumber);
        toast({
          title: "Call Initiated",
          description: "Calling " + conversation.displayName,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === "Enter" && e.shiftKey && !isExpanded) {
      e.preventDefault();
      setIsExpanded(true);
      // Focus textarea after expansion
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.value = message + "\n";
          setMessage(message + "\n");
        }
      }, 0);
    }
  };

  const handleFocus = () => {
    if (message.includes("\n") || message.length > 50) {
      setIsExpanded(true);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-end gap-3">
        {/* Message Type Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <Button
            variant={messageType === 'sms' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMessageType('sms')}
            className="h-7 px-2 text-xs"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            SMS
          </Button>
          <Button
            variant={messageType === 'call' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMessageType('call')}
            className="h-7 px-2 text-xs"
          >
            <Phone className="h-3 w-3 mr-1" />
            Call
          </Button>
        </div>

        {/* Message Input */}
        <div className="flex-1">
          {isExpanded ? (
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={() => {
                if (!message.trim()) {
                  setIsExpanded(false);
                }
              }}
              placeholder={`Message ${conversation.displayName}...`}
              className="min-h-[2.25rem] max-h-32 resize-none text-sm"
              rows={3}
            />
          ) : (
            <Input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={handleFocus}
              placeholder={`Message ${conversation.displayName}...`}
              className="h-9 text-sm"
            />
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
          size="sm"
          className="h-9 w-9 p-0"
        >
          {isSending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Helper Text */}
      <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        {messageType === 'sms' 
          ? 'Press Enter to send SMS, Shift+Enter for new line'
          : 'Press Enter to initiate call, Shift+Enter for new line'
        }
      </div>
    </div>
  );
}


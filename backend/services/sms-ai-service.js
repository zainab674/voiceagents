// services/sms-ai-service.js
class SMSAIService {
  constructor() {
    // Initialize AI service configuration
    this.defaultFirstMessage = "Hello! I'm your AI assistant. How can I help you today?";
    this.defaultEndMessage = "Thank you for chatting with me. Have a great day!";
  }

  /**
   * Generate first SMS message for new conversation
   */
  generateFirstSMSMessage(firstMessage, assistant) {
    if (firstMessage && firstMessage.trim()) {
      return firstMessage.trim();
    }
    
    // Use assistant's first message if available
    if (assistant?.first_message && assistant.first_message.trim()) {
      return assistant.first_message.trim();
    }
    
    return this.defaultFirstMessage;
  }

  /**
   * Generate AI response for ongoing conversation
   */
  async generateSMSResponse(userMessage, smsPrompt, conversationHistory, assistant) {
    try {
      // For now, return a simple response
      // In a real implementation, this would call an AI service like OpenAI, Claude, etc.
      
      if (smsPrompt && smsPrompt.trim()) {
        // Use the assistant's SMS prompt
        return this.generateResponseFromPrompt(userMessage, smsPrompt, conversationHistory);
      }
      
      // Default response based on user message
      return this.generateDefaultResponse(userMessage, conversationHistory);
      
    } catch (error) {
      console.error('Error generating SMS response:', error);
      return "I'm sorry, I'm having trouble processing your message right now. Please try again later.";
    }
  }

  /**
   * Generate response from custom prompt
   */
  generateResponseFromPrompt(userMessage, smsPrompt, conversationHistory) {
    // Simple implementation - in production, this would use an AI service
    const context = conversationHistory.length > 0 
      ? `Previous conversation: ${conversationHistory.slice(0, 3).map(msg => `${msg.direction}: ${msg.body}`).join(' ')}`
      : '';
    
    // For now, return a contextual response
    if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
      return "Hello! How can I assist you today?";
    } else if (userMessage.toLowerCase().includes('help')) {
      return "I'm here to help! What do you need assistance with?";
    } else if (userMessage.toLowerCase().includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    } else {
      return `I understand you said: "${userMessage}". How can I help you with that?`;
    }
  }

  /**
   * Generate default response
   */
  generateDefaultResponse(userMessage, conversationHistory) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return "Hello! How can I help you today?";
    } else if (message.includes('help')) {
      return "I'm here to help! What do you need assistance with?";
    } else if (message.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    } else if (message.includes('bye') || message.includes('goodbye')) {
      return "Goodbye! Have a great day!";
    } else {
      return "Thanks for your message! How can I assist you?";
    }
  }

  /**
   * Check if user wants to end conversation
   */
  isConversationEnd(message) {
    const endPhrases = [
      'bye', 'goodbye', 'see you later', 'talk to you later',
      'end conversation', 'stop', 'quit', 'exit'
    ];
    
    const messageLower = message.toLowerCase();
    return endPhrases.some(phrase => messageLower.includes(phrase));
  }

  /**
   * Generate end conversation message
   */
  generateEndMessage() {
    return this.defaultEndMessage;
  }

  /**
   * Validate message content
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message must be a non-empty string' };
    }
    
    if (message.trim().length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }
    
    if (message.length > 1600) { // SMS character limit
      return { valid: false, error: 'Message is too long (max 1600 characters)' };
    }
    
    return { valid: true };
  }

  /**
   * Format message for SMS
   */
  formatMessage(message) {
    if (!message) return '';
    
    // Remove extra whitespace and newlines
    let formatted = message.trim().replace(/\s+/g, ' ');
    
    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(formatted)) {
      formatted += '.';
    }
    
    return formatted;
  }

  /**
   * Extract intent from user message
   */
  extractIntent(message) {
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('appointment') || messageLower.includes('schedule')) {
      return 'appointment';
    } else if (messageLower.includes('question') || messageLower.includes('ask')) {
      return 'question';
    } else if (messageLower.includes('complaint') || messageLower.includes('problem')) {
      return 'complaint';
    } else if (messageLower.includes('info') || messageLower.includes('information')) {
      return 'information';
    } else {
      return 'general';
    }
  }

  /**
   * Generate contextual response based on intent
   */
  generateIntentResponse(intent, userMessage) {
    switch (intent) {
      case 'appointment':
        return "I'd be happy to help you with scheduling. What type of appointment are you looking for?";
      case 'question':
        return "I'm here to answer your questions. What would you like to know?";
      case 'complaint':
        return "I'm sorry to hear about your concern. Can you provide more details so I can help you?";
      case 'information':
        return "I can provide you with information. What specific details are you looking for?";
      default:
        return "How can I assist you today?";
    }
  }
}

export { SMSAIService };

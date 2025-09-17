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
      
      // Use the assistant's SMS prompt if available, otherwise fall back to the main prompt
      const promptToUse = smsPrompt && smsPrompt.trim() ? smsPrompt : (assistant?.prompt || '');
      
      if (promptToUse && promptToUse.trim()) {
        // Use the assistant's SMS prompt or main prompt as fallback
        return this.generateResponseFromPrompt(userMessage, promptToUse, conversationHistory);
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
    try {
      // Build conversation context
      const context = conversationHistory.length > 0 
        ? `Previous conversation:\n${conversationHistory.slice(0, 5).map(msg => 
            `${msg.direction === 'inbound' ? 'User' : 'Assistant'}: ${msg.body}`
          ).join('\n')}\n`
        : '';
      
      // Create a more intelligent response based on the agent's prompt
      const promptContext = smsPrompt || 'You are a helpful AI assistant.';
      
      // Analyze the user's message for intent and context
      const intent = this.extractIntent(userMessage);
      const messageLower = userMessage.toLowerCase();
      
      // Generate response based on agent's prompt and context
      if (promptContext.toLowerCase().includes('hospital') || promptContext.toLowerCase().includes('medical')) {
        return this.generateHospitalResponse(userMessage, context, intent);
      } else if (promptContext.toLowerCase().includes('sales') || promptContext.toLowerCase().includes('business')) {
        return this.generateSalesResponse(userMessage, context, intent);
      } else if (promptContext.toLowerCase().includes('support') || promptContext.toLowerCase().includes('help')) {
        return this.generateSupportResponse(userMessage, context, intent);
      } else {
        // Generic response using the agent's prompt
        return this.generateGenericResponse(userMessage, promptContext, context, intent);
      }
    } catch (error) {
      console.error('Error generating response from prompt:', error);
      return "I'm here to help! How can I assist you today?";
    }
  }

  /**
   * Generate hospital-specific response
   */
  generateHospitalResponse(userMessage, context, intent) {
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('appointment') || messageLower.includes('schedule')) {
      return "I'd be happy to help you schedule an appointment. What type of appointment do you need?";
    } else if (messageLower.includes('emergency') || messageLower.includes('urgent')) {
      return "If this is a medical emergency, please call 911 immediately. For non-emergency concerns, I can help you schedule an appointment.";
    } else if (messageLower.includes('hours') || messageLower.includes('open')) {
      return "Our hospital is open 24/7 for emergencies. For regular appointments, our hours are Monday-Friday 8AM-5PM. How can I help you today?";
    } else if (messageLower.includes('insurance') || messageLower.includes('payment')) {
      return "I can help you with insurance and payment questions. What specific information do you need?";
    } else if (messageLower.includes('hello') || messageLower.includes('hi')) {
      return "Hello! Welcome to our hospital. How can I assist you today?";
    } else {
      return "Thank you for contacting our hospital. I'm here to help with appointments, information, or any questions you may have. What do you need assistance with?";
    }
  }

  /**
   * Generate sales-specific response
   */
  generateSalesResponse(userMessage, context, intent) {
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('price') || messageLower.includes('cost')) {
      return "I'd be happy to provide pricing information. What product or service are you interested in?";
    } else if (messageLower.includes('demo') || messageLower.includes('trial')) {
      return "I can help you schedule a demo or trial. What would you like to see?";
    } else if (messageLower.includes('buy') || messageLower.includes('purchase')) {
      return "Great! I can help you with your purchase. What are you looking to buy?";
    } else if (messageLower.includes('hello') || messageLower.includes('hi')) {
      return "Hello! Thanks for your interest in our products. How can I help you today?";
    } else {
      return "I'm here to help you with our products and services. What would you like to know more about?";
    }
  }

  /**
   * Generate support-specific response
   */
  generateSupportResponse(userMessage, context, intent) {
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('problem') || messageLower.includes('issue') || messageLower.includes('bug')) {
      return "I'm sorry to hear you're experiencing an issue. Can you describe the problem in more detail so I can help you?";
    } else if (messageLower.includes('refund') || messageLower.includes('return')) {
      return "I can help you with refund and return questions. What product or service are you looking to return?";
    } else if (messageLower.includes('account') || messageLower.includes('login')) {
      return "I can help you with account-related issues. What specific problem are you having with your account?";
    } else if (messageLower.includes('hello') || messageLower.includes('hi')) {
      return "Hello! I'm here to help with any questions or issues you may have. How can I assist you?";
    } else {
      return "I'm here to provide support and assistance. What can I help you with today?";
    }
  }

  /**
   * Generate generic response using agent prompt
   */
  generateGenericResponse(userMessage, promptContext, context, intent) {
    const messageLower = userMessage.toLowerCase();
    
    // Extract key instructions from the agent's prompt
    const isFriendly = promptContext.toLowerCase().includes('friendly') || promptContext.toLowerCase().includes('helpful');
    const isProfessional = promptContext.toLowerCase().includes('professional') || promptContext.toLowerCase().includes('business');
    const isCasual = promptContext.toLowerCase().includes('casual') || promptContext.toLowerCase().includes('informal');
    
    let response = "";
    
    if (messageLower.includes('hello') || messageLower.includes('hi') || messageLower.includes('hey')) {
      if (isFriendly) {
        response = "Hello! Great to hear from you! How can I help you today?";
      } else if (isProfessional) {
        response = "Hello! Thank you for contacting us. How may I assist you?";
      } else {
        response = "Hi there! How can I help you today?";
      }
    } else if (messageLower.includes('help') || messageLower.includes('assistance')) {
      response = "I'm here to help! What do you need assistance with?";
    } else if (messageLower.includes('thank')) {
      response = "You're very welcome! Is there anything else I can help you with?";
    } else if (messageLower.includes('bye') || messageLower.includes('goodbye')) {
      response = "Thank you for reaching out! Have a great day!";
    } else {
      // Use the agent's prompt context to generate a relevant response
      if (promptContext.length > 50) {
        // Extract a relevant part of the prompt for context
        const promptWords = promptContext.split(' ').slice(0, 20).join(' ');
        response = `I understand you're asking about "${userMessage}". Based on my knowledge, I can help you with that. What specific information do you need?`;
      } else {
        response = `Thanks for your message: "${userMessage}". How can I help you with that?`;
      }
    }
    
    return response;
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

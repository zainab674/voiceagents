// services/sms-assistant-service.js
import { SMSDatabaseService } from './sms-database-service.js';
import { SMSAIService } from './sms-ai-service.js';

class SMSAssistantService {
  constructor(databaseService, aiService, twilioClient) {
    this.databaseService = databaseService;
    this.aiService = aiService;
    this.twilioClient = twilioClient;
  }

  /**
   * Main method to process incoming SMS
   */
  async processIncomingSMS(smsData) {
    try {
      console.log('Processing incoming SMS:', smsData);
      
      const { fromNumber, toNumber, messageBody, messageSid } = smsData;

      // 1. Get assistant configuration for this phone number
      console.log(`Looking up assistant for phone number: ${toNumber}`);
      const assistant = await this.databaseService.getAssistantByPhoneNumber(toNumber);
      
      if (!assistant) {
        console.log(`No assistant found for phone number: ${toNumber}`);
        await this.sendErrorResponse(fromNumber, toNumber, 'Sorry, this number is not configured for SMS assistance.');
        return;
      }

      console.log(`Found assistant: ${assistant.name} (${assistant.id})`);
      console.log('Assistant config:', {
        first_message: assistant.first_message,
        prompt: assistant.prompt,
        sms_prompt: assistant.sms_prompt
      });

      // 2. Get user ID for database operations
      console.log(`Getting user ID for assistant: ${assistant.id}`);
      const userId = await this.databaseService.getUserIdFromAssistant(assistant.id);
      if (!userId) {
        console.error(`No user ID found for assistant: ${assistant.id}`);
        await this.sendErrorResponse(fromNumber, toNumber, 'Sorry, there was an error processing your message.');
        return;
      }
      
      console.log(`Found user_id for incoming SMS: ${userId}`);

      // 3. Save incoming SMS to database
      console.log('Saving incoming SMS to database...');
      const savedSMS = await this.databaseService.saveIncomingSMS({
        messageSid,
        toNumber,
        fromNumber,
        messageBody,
        userId
      });
      
      if (savedSMS) {
        console.log('SMS saved successfully to database');
      } else {
        console.log('Failed to save SMS to database');
      }

      // 4. Check if this is a new conversation
      console.log('Checking if this is a new conversation...');
      const isNewConversation = await this.databaseService.isNewConversation(fromNumber, assistant.id);
      console.log(`Is new conversation: ${isNewConversation}`);
      
      let responseMessage;

      if (isNewConversation) {
        console.log('New conversation detected - generating first SMS message');
        // Send first SMS message
        responseMessage = this.aiService.generateFirstSMSMessage(assistant.first_message, assistant);
        console.log('First SMS message generated:', responseMessage);
      } else {
        console.log('Ongoing conversation detected');
        
        // Check if user wants to end conversation
        if (this.aiService.isConversationEnd(messageBody)) {
          console.log('User wants to end conversation');
          responseMessage = this.aiService.generateEndMessage();
        } else {
          console.log('Getting conversation history for AI response...');
          // Get conversation history for context
          const conversationHistory = await this.databaseService.getConversationHistory(
            fromNumber, 
            assistant.id, 
            10 // Last 10 messages for context
          );
          console.log(`Found ${conversationHistory.length} previous messages`);
          
          // Generate AI response
          console.log('Generating AI response...');
          responseMessage = await this.aiService.generateSMSResponse(
            messageBody,
            assistant.sms_prompt,
            conversationHistory,
            assistant
          );
          console.log('AI response generated:', responseMessage);
        }
      }

      // 5. Send response via Twilio
      if (responseMessage) {
        console.log('Sending SMS response via Twilio...');
        await this.sendSMSResponse(fromNumber, toNumber, responseMessage, userId);
        console.log('SMS response sent successfully');
      } else {
        console.log('No response message generated - skipping Twilio send');
      }

    } catch (error) {
      console.error('Error processing incoming SMS:', error);
      
      // Send error response to user
      try {
        await this.sendErrorResponse(smsData.fromNumber, smsData.toNumber, 
          'Sorry, I encountered an error processing your message. Please try again later.');
      } catch (sendError) {
        console.error('Error sending error response:', sendError);
      }
    }
  }

  /**
   * Send SMS response via Twilio
   */
  async sendSMSResponse(toNumber, fromNumber, message, userId) {
    try {
      console.log(`Sending SMS response to ${toNumber}: ${message}`);
      
      // Get user's Twilio credentials
      const credentials = await this.databaseService.getUserTwilioCredentials(userId);
      if (!credentials) {
        throw new Error('No Twilio credentials found for user');
      }

      // Create Twilio client with user's credentials
      const twilio = (await import('twilio')).default;
      const userTwilioClient = twilio(credentials.account_sid, credentials.auth_token);
      
      const twilioMessage = await userTwilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: toNumber
      });

      console.log(`SMS sent successfully. SID: ${twilioMessage.sid}, Status: ${twilioMessage.status}`);

      // Save outgoing SMS to database
      console.log('Saving outgoing SMS to database...');
      const savedOutgoing = await this.databaseService.saveOutgoingSMS({
        messageSid: twilioMessage.sid,
        toNumber: toNumber,
        fromNumber: fromNumber,
        messageBody: message,
        status: twilioMessage.status,
        userId: userId
      });
      
      if (savedOutgoing) {
        console.log('Outgoing SMS saved to database successfully');
      } else {
        console.log('Failed to save outgoing SMS to database');
      }

      return twilioMessage;
      
    } catch (error) {
      console.error('Error sending SMS response:', error);
      console.error('Twilio error details:', error.message, error.code);
      throw error;
    }
  }

  /**
   * Send error response to user
   */
  async sendErrorResponse(toNumber, fromNumber, errorMessage) {
    try {
      const twilioMessage = await this.twilioClient.messages.create({
        body: errorMessage,
        from: fromNumber,
        to: toNumber
      });

      console.log(`Error SMS sent. SID: ${twilioMessage.sid}`);
      return twilioMessage;
      
    } catch (error) {
      console.error('Error sending error response:', error);
      throw error;
    }
  }

  /**
   * Get SMS conversation statistics
   */
  async getConversationStats(phoneNumber, assistantId) {
    try {
      const conversationHistory = await this.databaseService.getConversationHistory(
        phoneNumber, 
        assistantId, 
        100 // Get more messages for stats
      );

      const stats = {
        totalMessages: conversationHistory.length,
        inboundMessages: conversationHistory.filter(msg => msg.direction === 'inbound').length,
        outboundMessages: conversationHistory.filter(msg => msg.direction === 'outbound').length,
        lastMessageTime: conversationHistory.length > 0 ? conversationHistory[0].created_at : null
      };

      return stats;
      
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return null;
    }
  }

  /**
   * Test SMS functionality
   */
  async testSMS(phoneNumber, testMessage) {
    try {
      console.log(`Testing SMS to ${phoneNumber}: ${testMessage}`);
      
      const assistant = await this.databaseService.getAssistantByPhoneNumber(phoneNumber);
      if (!assistant) {
        throw new Error('No assistant found for this phone number');
      }

      const userId = await this.databaseService.getUserIdFromAssistant(assistant.id);
      if (!userId) {
        throw new Error('No user ID found for assistant');
      }

      // Generate test response
      const responseMessage = await this.aiService.generateSMSResponse(
        testMessage,
        assistant.sms_prompt,
        [],
        assistant
      );

      return {
        success: true,
        response: responseMessage,
        assistant: assistant.name
      };
      
    } catch (error) {
      console.error('Error testing SMS:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send SMS message
   */
  async sendSMS(toNumber, fromNumber, message, userId) {
    try {
      console.log(`Sending SMS to ${toNumber}: ${message}`);
      
      const twilioMessage = await this.twilioClient.messages.create({
        body: message,
        from: fromNumber,
        to: toNumber
      });

      console.log(`SMS sent successfully. SID: ${twilioMessage.sid}, Status: ${twilioMessage.status}`);

      // Save outgoing SMS to database
      const savedOutgoing = await this.databaseService.saveOutgoingSMS({
        messageSid: twilioMessage.sid,
        toNumber: toNumber,
        fromNumber: fromNumber,
        messageBody: message,
        status: twilioMessage.status,
        userId: userId
      });
      
      return {
        success: true,
        messageSid: twilioMessage.sid,
        status: twilioMessage.status,
        saved: !!savedOutgoing
      };
      
    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }
}

export { SMSAssistantService };

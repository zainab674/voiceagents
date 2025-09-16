# SMS Integration for Voiceagents Project

This document describes the SMS functionality implemented in the voiceagents project, based on the sass-livekit SMS implementation.

## Overview

The SMS integration allows users to:
- Send SMS messages to contacts
- Receive and process incoming SMS messages
- Automatically respond to SMS using AI assistants
- Track SMS message status and delivery
- View SMS conversations in the interface

## Architecture

### Backend Components

#### 1. SMS Services
- **`sms-database-service.js`** - Database operations for SMS messages
- **`sms-ai-service.js`** - AI response generation and message processing
- **`sms-assistant-service.js`** - Main SMS processing and Twilio integration

#### 2. SMS Controllers
- **`smsController.js`** - API endpoints for SMS operations
- **`smsRoute.js`** - SMS webhook and test endpoints

#### 3. Database Schema
- **`create-sms-messages-table.sql`** - SMS messages table with RLS policies

### API Endpoints

#### SMS Operations (Authenticated)
- **POST** `/api/v1/sms/send` - Send SMS message
- **GET** `/api/v1/sms/conversation/:conversationId` - Get SMS messages for conversation
- **GET** `/api/v1/sms/stats` - Get SMS statistics for user

#### SMS Webhooks (Public)
- **POST** `/api/v1/sms/webhook` - Receive incoming SMS from Twilio
- **POST** `/api/v1/sms/status-callback` - Handle SMS delivery status updates

#### Twilio Routes (Alternative)
- **POST** `/api/v1/twilio/sms/send` - Send SMS via Twilio
- **GET** `/api/v1/twilio/sms/conversation/:conversationId` - Get SMS messages
- **GET** `/api/v1/twilio/sms/stats` - Get SMS statistics
- **POST** `/api/v1/twilio/sms/webhook` - SMS webhook
- **POST** `/api/v1/twilio/sms/status-callback` - Status callback

## Features

### Automatic SMS Webhook Configuration
When a phone number is assigned to a user's main trunk, the system automatically:
1. Configures the SMS webhook URL
2. Sets the webhook method to POST
3. Enables SMS receiving for the phone number

### AI-Powered SMS Responses
- **First Message**: Customizable welcome message for new conversations
- **Contextual Responses**: AI generates responses based on conversation history
- **Intent Recognition**: Detects user intent (appointment, question, complaint, etc.)
- **Conversation Management**: Handles conversation end detection

### Message Processing
- **Incoming SMS**: Automatically processed and stored in database
- **Outgoing SMS**: Sent via Twilio and tracked
- **Status Updates**: Real-time delivery status tracking
- **Error Handling**: Comprehensive error handling and user feedback

## Setup Instructions

### 1. Database Migration
Run the SMS messages migration in Supabase SQL editor:

```sql
-- Copy and paste the contents of create-sms-messages-table.sql
```

### 2. Environment Variables
Ensure these environment variables are set:

```bash
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Optional (for webhook URLs)
BACKEND_URL=https://your-domain.com
NGROK_URL=https://your-ngrok-url.ngrok.io
```

### 3. Twilio Configuration
1. Set up Twilio credentials in your app
2. Purchase a Twilio phone number
3. The system will automatically configure SMS webhooks when you assign the number

### 4. Phone Number Assignment
When you assign a phone number to an assistant:
1. The number is attached to the user's main trunk
2. SMS webhook is automatically configured
3. The number is ready to receive and process SMS

## Usage

### Sending SMS
```javascript
// Send SMS via API
const response = await fetch('/api/v1/sms/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    accountSid: 'AC...',
    authToken: '...',
    to: '+1234567890',
    from: '+0987654321',
    body: 'Hello, this is a test message',
    userId: 'user-id'
  })
});
```

### Receiving SMS
SMS messages are automatically received via webhook and processed by the AI assistant.

### Getting SMS Messages
```javascript
// Get SMS messages for a conversation
const response = await fetch('/api/v1/sms/conversation/conv_123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Database Schema

### sms_messages Table
```sql
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY,
  message_sid TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES auth.users(id),
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  body TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  num_segments TEXT,
  price TEXT,
  price_unit TEXT,
  date_created TIMESTAMPTZ NOT NULL,
  date_sent TIMESTAMPTZ,
  date_updated TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## AI Response Configuration

### Assistant Settings
Configure SMS behavior in your assistant settings:
- **First Message**: Custom welcome message for new conversations
- **Prompt**: AI prompt for generating responses
- **Conversation Management**: Automatic conversation end detection

### Response Types
- **New Conversation**: Sends first message or custom welcome
- **Ongoing Conversation**: AI-generated contextual response
- **Conversation End**: Polite goodbye message
- **Error Handling**: User-friendly error messages

## Testing

### Test SMS Integration
```bash
cd backend
node test-sms-integration.js
```

### Test SMS Webhook
```bash
curl -X POST http://localhost:4000/api/v1/sms/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&To=%2B0987654321&Body=Hello&MessageSid=SM123"
```

### Test SMS Sending
```bash
curl -X POST http://localhost:4000/api/v1/sms/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "accountSid": "AC...",
    "authToken": "...",
    "to": "+1234567890",
    "body": "Test message"
  }'
```

## Security

### Row Level Security (RLS)
- Users can only access their own SMS messages
- Automatic user ID filtering on all queries
- Secure webhook endpoints

### Input Validation
- Phone number format validation
- Message length limits (1600 characters)
- Content sanitization

### Error Handling
- Graceful error responses
- No sensitive data exposure
- Comprehensive logging

## Troubleshooting

### Common Issues

1. **SMS not being received**
   - Check webhook URL configuration in Twilio console
   - Verify BACKEND_URL environment variable
   - Check server logs for webhook errors

2. **SMS not sending**
   - Verify Twilio credentials
   - Check account balance
   - Validate phone number format

3. **AI responses not working**
   - Check assistant configuration
   - Verify database connection
   - Check AI service logs

4. **Database errors**
   - Run the SMS migration
   - Check RLS policies
   - Verify user permissions

### Debug Mode
Enable detailed logging:
```bash
NODE_ENV=development
```

## API Reference

### Send SMS
```typescript
POST /api/v1/sms/send
{
  "accountSid": "AC...",
  "authToken": "...",
  "to": "+1234567890",
  "from": "+0987654321",
  "body": "Message text",
  "userId": "user-id"
}
```

### Get SMS Messages
```typescript
GET /api/v1/sms/conversation/:conversationId
Query params: accountSid, authToken
```

### SMS Webhook
```typescript
POST /api/v1/sms/webhook
Content-Type: application/x-www-form-urlencoded
Twilio webhook parameters
```

## Future Enhancements

- **MMS Support**: Media message handling
- **Message Templates**: Predefined response templates
- **Bulk SMS**: Send to multiple recipients
- **Advanced Analytics**: Detailed SMS metrics and reporting
- **Message Scheduling**: Send SMS at specific times
- **Conversation Threading**: Better conversation organization

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify Twilio account configuration
3. Test webhook endpoints manually
4. Check database connection and permissions

## Conclusion

The SMS integration provides a complete solution for SMS communication with AI-powered responses, automatic webhook configuration, and comprehensive message tracking. The system is designed to be robust, secure, and easy to use.

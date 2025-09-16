# Outbound Calls Implementation for Voiceagents

This document explains the complete outbound calls implementation in the voiceagents project, including campaign management, LiveKit integration, and Twilio webhooks.

## Overview

The outbound calls system allows users to create and manage campaigns that automatically call contacts using AI assistants. The system integrates with LiveKit for SIP-based calling and Twilio for call routing and status updates.

## Architecture

### Key Components

1. **Campaign Management** - Create, manage, and execute calling campaigns
2. **LiveKit Integration** - SIP-based outbound calling through LiveKit
3. **Twilio Integration** - Call routing and status callbacks
4. **Database Schema** - Campaign and call tracking
5. **Campaign Execution Engine** - Automated campaign processing

### Flow Diagram

```
User Creates Campaign → Campaign Engine → LiveKit SIP → Twilio → Target Phone
                     ↓
                Database Tracking ← Status Callbacks ← Twilio
```

## Database Schema

### Tables Created

1. **campaigns** - Campaign configuration and metrics
2. **campaign_calls** - Individual call records
3. **contact_lists** - Contact list management
4. **contacts** - Individual contact records
5. **csv_files** - CSV file uploads
6. **csv_contacts** - Contacts from CSV files

### Key Fields

**campaigns table:**
- `execution_status` - idle, running, paused, completed, error
- `daily_cap` - Maximum calls per day
- `calling_days` - Days of week to call
- `start_hour` / `end_hour` - Calling hours
- `campaign_prompt` - AI assistant script

**campaign_calls table:**
- `status` - pending, calling, answered, completed, failed
- `outcome` - interested, not_interested, callback, do_not_call
- `call_duration` - Call length in seconds
- `room_name` - LiveKit room for the call

## API Endpoints

### Campaign Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/campaigns` | List all campaigns |
| POST | `/api/v1/campaigns` | Create new campaign |
| GET | `/api/v1/campaigns/:id` | Get campaign details |
| PUT | `/api/v1/campaigns/:id` | Update campaign |
| DELETE | `/api/v1/campaigns/:id` | Delete campaign |
| POST | `/api/v1/campaigns/:id/start` | Start campaign |
| POST | `/api/v1/campaigns/:id/pause` | Pause campaign |
| POST | `/api/v1/campaigns/:id/resume` | Resume campaign |
| POST | `/api/v1/campaigns/:id/stop` | Stop campaign |
| GET | `/api/v1/campaigns/:id/status` | Get campaign status |

### Outbound Calls

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/outbound-calls/initiate` | Initiate outbound call |
| POST | `/api/v1/outbound-calls/status-callback` | Twilio status callback |
| GET | `/api/v1/outbound-calls/campaign/:id` | Get campaign calls |
| PUT | `/api/v1/outbound-calls/:id/outcome` | Update call outcome |
| GET | `/api/v1/outbound-calls/campaign/:id/stats` | Get campaign stats |

### LiveKit Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/livekit/outbound-calls/create-participant` | Create SIP participant |
| GET | `/api/v1/livekit/outbound-calls/trunk/:assistantId` | Get assistant trunk |
| GET | `/api/v1/livekit/outbound-calls/trunks` | List all trunks |
| POST | `/api/v1/livekit/outbound-calls/create-trunk` | Create outbound trunk |
| POST | `/api/v1/livekit/outbound-calls/create-call` | Create complete call |
| POST | `/api/v1/livekit/outbound-calls/dispatch-agent` | Dispatch AI agent |

## Setup Instructions

### 1. Database Setup

Run the database schema migration:

```sql
-- Execute this in Supabase SQL editor
\i backend/database/create-outbound-calls-schema.sql
```

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# LiveKit
LIVEKIT_HOST=wss://your-livekit-host.com
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LK_AGENT_NAME=ai

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Server
BACKEND_URL=http://localhost:4000
NGROK_URL=https://your-ngrok-url.ngrok.io
ENABLE_CAMPAIGN_ENGINE=true
```

### 3. LiveKit Setup

1. **Deploy LiveKit Server** (or use LiveKit Cloud)
2. **Configure SIP Integration** with Twilio
3. **Deploy AI Agent Worker** for handling calls

### 4. Twilio Setup

1. **Configure Webhooks** for each phone number:
   - Voice URL: `https://your-domain.com/api/v1/livekit/room/{roomName}`
   - Status Callback: `https://your-domain.com/api/v1/outbound-calls/status-callback`

2. **Enable Call Recording** (optional)

## Usage Examples

### Creating a Campaign

```javascript
const campaign = await fetch('/api/v1/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Q4 Sales Outreach',
    assistantId: 'assistant-uuid',
    contactSource: 'contact_list',
    contactListId: 'list-uuid',
    dailyCap: 100,
    callingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    startHour: 9,
    endHour: 17,
    campaignPrompt: 'Hello {name}, this is Sarah from Acme Corp. I\'m calling about our Q4 special offer...'
  })
});
```

### Starting a Campaign

```javascript
await fetch('/api/v1/campaigns/campaign-uuid/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Manual Outbound Call

```javascript
const call = await fetch('/api/v1/outbound-calls/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    campaignId: 'campaign-uuid',
    phoneNumber: '+1234567890',
    contactName: 'John Doe',
    assistantId: 'assistant-uuid'
  })
});
```

## Campaign Execution Engine

The campaign execution engine automatically processes campaigns based on their configuration:

### Features

- **Scheduled Execution** - Runs campaigns based on calling hours and days
- **Daily Limits** - Respects daily call caps
- **Continuous Processing** - Processes all contacts in a campaign
- **Error Handling** - Continues processing even if individual calls fail
- **Metrics Tracking** - Updates campaign statistics in real-time

### Configuration

- **Calling Hours** - Set start and end hours (24/7 if both set to 0)
- **Calling Days** - Select which days of the week to call
- **Daily Cap** - Maximum number of calls per day
- **Call Delay** - 2-second delay between calls (configurable)

## LiveKit Integration

### Outbound Trunk Creation

When assigning a phone number to an assistant, the system automatically creates:

1. **Inbound Trunk** - For receiving calls
2. **Outbound Trunk** - For making calls

### SIP Participant Creation

Each outbound call creates a SIP participant that:

1. **Connects to LiveKit Room** - Establishes audio connection
2. **Dials Target Number** - Initiates call through Twilio
3. **Dispatches AI Agent** - AI handles the conversation
4. **Tracks Call Status** - Monitors call progress

## Call Status Tracking

### Status Flow

```
pending → calling → answered → completed
    ↓
  failed (if error occurs)
```

### Outcomes

- **interested** - Contact is interested
- **not_interested** - Contact is not interested
- **callback** - Contact wants callback
- **do_not_call** - Contact requests no more calls
- **voicemail** - Call went to voicemail
- **wrong_number** - Invalid phone number

## Webhook Configuration

### Twilio Status Callbacks

Configure these webhooks in Twilio Console:

1. **Status Callback URL**: `https://your-domain.com/api/v1/outbound-calls/status-callback`
2. **Status Callback Events**: initiated, ringing, answered, completed
3. **Recording Status Callback**: `https://your-domain.com/api/v1/recording/status`

### LiveKit Room Webhooks

1. **Room URL**: `https://your-domain.com/api/v1/livekit/room/{roomName}`
2. **Method**: POST
3. **Purpose**: Handles incoming call routing to LiveKit

## Testing

### Test Script

Run the integration test:

```bash
node test-outbound-integration.js
```

### Manual Testing

1. **Create Test Campaign**:
   ```bash
   curl -X POST http://localhost:4000/api/v1/campaigns \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"name":"Test Campaign","assistantId":"assistant-uuid","contactSource":"contact_list","contactListId":"list-uuid"}'
   ```

2. **Start Campaign**:
   ```bash
   curl -X POST http://localhost:4000/api/v1/campaigns/campaign-uuid/start \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Check Status**:
   ```bash
   curl http://localhost:4000/api/v1/campaigns/campaign-uuid/status \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Troubleshooting

### Common Issues

1. **"No outbound trunk found"**
   - Ensure assistant has a phone number assigned
   - Check if outbound trunk was created successfully

2. **"LiveKit connection failed"**
   - Verify LiveKit credentials
   - Check LiveKit server status

3. **"Campaign not calling"**
   - Check calling hours and days
   - Verify daily cap hasn't been reached
   - Ensure campaign status is 'running'

4. **"Calls not connecting"**
   - Verify Twilio webhook URLs
   - Check LiveKit SIP configuration
   - Ensure AI agent worker is running

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development DEBUG=* npm run dev
```

### Monitoring

- **Campaign Logs** - Check server console for campaign execution
- **Call Logs** - Monitor individual call status updates
- **LiveKit Logs** - Check LiveKit server logs for SIP issues
- **Twilio Logs** - Monitor Twilio console for call status

## Security Considerations

1. **Authentication** - All endpoints require valid JWT tokens
2. **Row Level Security** - Database policies ensure users only access their data
3. **Input Validation** - All inputs are validated and sanitized
4. **Rate Limiting** - Consider implementing rate limiting for production

## Performance Optimization

1. **Database Indexes** - Optimized for common queries
2. **Call Batching** - Process multiple calls efficiently
3. **Error Recovery** - Graceful handling of failed calls
4. **Resource Management** - Proper cleanup of resources

## Production Deployment

1. **Use HTTPS** for all webhook URLs
2. **Set up monitoring** and alerting
3. **Configure proper logging** levels
4. **Implement backup** strategies
5. **Set up health checks** for all services

## Conclusion

The outbound calls implementation provides a complete solution for automated calling campaigns with AI assistants. The system is designed to be scalable, reliable, and easy to use while maintaining high call quality through LiveKit integration.

For additional support or questions, refer to the individual service documentation or contact the development team.

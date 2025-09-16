# Campaign Execution and Outbound Calls

This document explains the campaign execution engine and outbound calling functionality in the voiceagents project, implementing the same features as sass-livekit.

## Overview

The campaign execution system provides:
- **Continuous Campaign Execution** - Processes all contacts immediately and continuously
- **LiveKit Integration** - Uses LiveKit SIP participants for outbound calls
- **AI Agent Dispatch** - Dispatches AI agents to handle calls
- **Real-time Monitoring** - Tracks campaign progress and call status
- **Error Handling** - Robust error recovery and call failure management

## Architecture

### Campaign Execution Engine

The campaign execution engine (`campaign-execution-engine.js`) is the core component that:

1. **Monitors Active Campaigns** - Checks for running campaigns every 30 seconds
2. **Processes Contacts** - Gets contacts from CSV files or contact lists
3. **Executes Calls** - Creates LiveKit SIP participants for outbound calls
4. **Tracks Progress** - Updates campaign metrics and call status
5. **Handles Errors** - Manages failures and retries

### LiveKit Integration

The system uses LiveKit for:
- **Room Management** - Creates and manages call rooms
- **SIP Participants** - Establishes outbound calls via SIP
- **Agent Dispatch** - Dispatches AI agents to handle calls
- **Metadata Handling** - Passes campaign and contact information

### Database Integration

Campaign data is stored in:
- **campaigns** - Campaign configuration and metrics
- **campaign_calls** - Individual call records
- **contact_lists** - User-created contact lists
- **csv_contacts** - Contacts from uploaded CSV files
- **phone_number** - Assistant phone numbers and trunk associations

## Key Features

### 1. Continuous Campaign Execution

Unlike queue-based systems, this implementation processes all contacts immediately:

```javascript
// Process all contacts immediately and continuously
for (let i = 0; i < contacts.length; i++) {
  const contact = contacts[i];
  
  // Check if campaign should continue
  if (!this.shouldExecuteCampaign(campaign)) {
    await this.pauseCampaign(campaign.id, 'Daily cap reached or outside calling hours');
    return;
  }

  // Execute call immediately
  await this.executeCallDirect(campaign, contact, i + 1);
  
  // Small delay between calls
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### 2. LiveKit SIP Integration

Creates SIP participants for outbound calls:

```javascript
// Create SIP participant with campaign metadata
const metadata = {
  agentId: campaign.assistant_id,
  callType: "telephone",
  callId: callId,
  dir: "outbound",
  customer_name: campaignCall.contact_name || 'Unknown',
  context: campaign.campaign_prompt || '',
  phone_number: fromNumber,
  isWebCall: false,
  to_phone_number: toNumber,
  isGoogleSheet: false,
  campaignId: campaign.id,
  source: 'campaign'
};

const sipParticipantOptions = {
  participantIdentity: `identity-${Date.now()}`,
  participantName: JSON.stringify(metadata),
  krispEnabled: true
};

const participant = await sipClient.createSipParticipant(
  outboundTrunkId,
  toNumber,
  roomName,
  sipParticipantOptions
);
```

### 3. Agent Dispatch

Dispatches AI agents to handle calls:

```javascript
// Dispatch agent with campaign metadata
const dispatchBody = {
  agent_name: agentName,
  room: roomName,
  metadata: JSON.stringify({
    phone_number: toNumber,
    agentId: campaign.assistant_id,
    callType: 'campaign',
    campaignId: campaign.id,
    contactName: campaignCall.contact_name || 'Unknown',
    campaignPrompt: campaign.campaign_prompt || '',
    outbound_trunk_id: outboundTrunkId,
  }),
};

const dispatchResult = await agentDispatchClient.createDispatch(
  roomName, 
  agentName, 
  { metadata: dispatchBody.metadata }
);
```

### 4. Campaign Status Management

Tracks campaign execution status:

- **idle** - Campaign created but not started
- **running** - Campaign actively making calls
- **paused** - Campaign temporarily stopped
- **completed** - Campaign finished all contacts
- **error** - Campaign encountered an error

### 5. Call Status Tracking

Monitors individual call status:

- **pending** - Call queued for execution
- **calling** - Call in progress
- **answered** - Call was answered
- **completed** - Call finished successfully
- **failed** - Call failed to connect
- **no_answer** - Call was not answered
- **busy** - Line was busy

## Configuration

### Environment Variables

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# LiveKit
LIVEKIT_HOST=wss://your-livekit-host
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LK_AGENT_NAME=ai

# Campaign Engine
ENABLE_CAMPAIGN_ENGINE=true
NODE_ENV=development
```

### Database Setup

Ensure the following tables exist:
- `campaigns` - Campaign configuration
- `campaign_calls` - Call records
- `contact_lists` - Contact lists
- `csv_contacts` - CSV contacts
- `phone_number` - Phone number assignments

## Usage

### Starting Campaign Execution

1. **Enable Campaign Engine** - Set `ENABLE_CAMPAIGN_ENGINE=true`
2. **Start Server** - Run `npm run dev`
3. **Create Campaign** - Use the frontend to create a campaign
4. **Start Campaign** - Click "Start" on the campaign

### Campaign Execution Flow

1. **Campaign Start** - User clicks "Start" on a campaign
2. **Status Update** - Campaign status changes to "running"
3. **Contact Processing** - Engine gets contacts from CSV or contact list
4. **Call Execution** - Creates LiveKit SIP participant for each contact
5. **Agent Dispatch** - Dispatches AI agent to handle the call
6. **Status Tracking** - Updates call status and campaign metrics
7. **Completion** - Marks campaign as completed when all contacts processed

### Monitoring Campaigns

- **Real-time Status** - Check campaign status in frontend
- **Call History** - View individual call records
- **Metrics** - Monitor dials, pickups, outcomes
- **Logs** - Check server logs for execution details

## API Endpoints

### Campaign Management

- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/campaigns` - List campaigns
- `POST /api/v1/campaigns/:id/start` - Start campaign
- `POST /api/v1/campaigns/:id/pause` - Pause campaign
- `POST /api/v1/campaigns/:id/resume` - Resume campaign
- `POST /api/v1/campaigns/:id/stop` - Stop campaign

### Campaign Status

- `GET /api/v1/campaigns/:id/status` - Get campaign status
- `GET /api/v1/campaigns/:id/calls` - Get campaign calls
- `PUT /api/v1/outbound-calls/:callId/outcome` - Update call outcome

### LiveKit Integration

- `POST /api/v1/livekit/outbound-calls/create-participant` - Create SIP participant
- `GET /api/v1/livekit/outbound-calls/trunk/:assistantId` - Get outbound trunk
- `GET /api/v1/livekit/outbound-calls/trunks` - List outbound trunks

## Error Handling

### Common Issues

1. **No Outbound Trunk** - Assistant doesn't have outbound trunk configured
2. **Invalid Phone Number** - Phone number not in E.164 format
3. **LiveKit Connection** - LiveKit service unavailable
4. **Agent Dispatch** - AI agent not running or accessible
5. **Database Errors** - Database connection or permission issues

### Error Recovery

- **Call Failures** - Mark as failed and continue with next contact
- **Campaign Errors** - Pause campaign and log error
- **Connection Issues** - Retry with exponential backoff
- **Missing Data** - Skip invalid contacts and continue

## Performance Optimization

### Call Rate Limiting

- **2 Second Delay** - Between calls to avoid overwhelming systems
- **Daily Caps** - Respect campaign daily call limits
- **Calling Hours** - Only call during configured hours
- **Concurrent Limits** - Process one campaign at a time

### Database Optimization

- **Batch Updates** - Update campaign metrics in batches
- **Indexed Queries** - Use indexed fields for lookups
- **Connection Pooling** - Reuse database connections
- **Query Optimization** - Efficient database queries

### Memory Management

- **Contact Processing** - Process contacts in batches
- **Call Cleanup** - Clean up completed calls
- **Error Logging** - Log errors without storing in memory
- **Resource Monitoring** - Monitor memory usage

## Troubleshooting

### Debug Logging

Enable debug logging to see detailed execution:

```bash
DEBUG=campaigns,outbound,livekit npm run dev
```

### Common Debug Steps

1. **Check Campaign Status** - Verify campaign is in "running" state
2. **Verify Contacts** - Ensure contacts exist and are valid
3. **Check Outbound Trunk** - Verify assistant has outbound trunk
4. **Test LiveKit Connection** - Verify LiveKit is accessible
5. **Check Agent Status** - Ensure AI agent is running
6. **Review Logs** - Check server logs for errors

### Monitoring

- **Campaign Metrics** - Track dials, pickups, outcomes
- **Call Status** - Monitor individual call status
- **Error Rates** - Track call failure rates
- **Performance** - Monitor execution speed and resource usage

## Security Considerations

### Data Protection

- **Contact Privacy** - Encrypt contact information
- **Call Recording** - Secure call recording storage
- **Access Control** - User-based campaign access
- **Audit Logging** - Log all campaign activities

### Compliance

- **Calling Hours** - Respect local calling hour restrictions
- **Do Not Call** - Honor do-not-call requests
- **Data Retention** - Implement data retention policies
- **Consent Management** - Track consent for calls

## Best Practices

### Campaign Design

- **Realistic Goals** - Set achievable daily caps
- **Quality Contacts** - Use high-quality contact lists
- **Testing** - Test with small campaigns first
- **Monitoring** - Monitor campaign performance closely

### Call Management

- **Professional Scripts** - Use professional campaign prompts
- **Call Quality** - Ensure good call quality
- **Follow-up** - Implement follow-up processes
- **Feedback** - Collect and act on feedback

### System Maintenance

- **Regular Updates** - Keep system components updated
- **Performance Monitoring** - Monitor system performance
- **Backup Strategy** - Implement data backup
- **Disaster Recovery** - Plan for system failures

## Changelog

### Version 1.0.0
- Initial campaign execution engine implementation
- LiveKit SIP participant integration
- Agent dispatch functionality
- Campaign status and metrics tracking
- Error handling and recovery
- Database integration and persistence
- Real-time monitoring and control
- Performance optimization
- Security and compliance features

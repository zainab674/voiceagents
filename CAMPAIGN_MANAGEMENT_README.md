# Campaign Management System

This document explains the comprehensive campaign management functionality in the voiceagents project, allowing users to create, manage, and execute automated outbound calling campaigns.

## Overview

The campaign management system enables users to:
- Create and configure outbound calling campaigns
- Manage campaign settings and schedules
- Monitor campaign performance in real-time
- Execute campaigns using AI agents
- Track call outcomes and statistics
- Manage contact sources (CSV files and contact lists)

## Features

### Campaign Creation
- **Campaign Configuration** - Set campaign name, assistant, contact source, and daily limits
- **Schedule Management** - Configure calling days and hours
- **Prompt Customization** - Create AI agent scripts with personalization placeholders
- **Contact Source Selection** - Choose between CSV files or contact lists
- **Terms of Use** - Legal compliance acceptance before campaign creation

### Campaign Management
- **Status Control** - Start, pause, resume, and stop campaigns
- **Real-time Monitoring** - Live campaign status and progress tracking
- **Performance Metrics** - Call statistics, answer rates, and outcomes
- **Call History** - Detailed logs of all campaign calls
- **Queue Management** - Monitor queued, processing, and completed calls

### Campaign Execution
- **Automated Calling** - Background execution engine for continuous calling
- **AI Agent Integration** - LiveKit-powered AI agents for call handling
- **Twilio Integration** - Reliable outbound call delivery
- **Smart Scheduling** - Respects calling hours and daily limits
- **Error Handling** - Robust error management and retry logic

## Architecture

### Backend Components

#### Database Schema
- **campaigns** - Main campaign configuration and metadata
- **campaign_calls** - Individual call records and outcomes
- **contact_lists** - User-created contact lists
- **contacts** - Individual contact records
- **csv_files** - Uploaded CSV file metadata
- **csv_contacts** - Contacts extracted from CSV files

#### Services
- **campaign-execution-engine.js** - Core campaign execution logic
- **outbound-calls-service.js** - Twilio outbound call management
- **livekit-outbound-service.js** - LiveKit AI agent integration
- **csv-service.js** - CSV file processing and contact management

#### API Routes
- **POST /api/v1/campaigns** - Create new campaign
- **GET /api/v1/campaigns** - List user campaigns
- **GET /api/v1/campaigns/:id** - Get campaign details
- **PUT /api/v1/campaigns/:id** - Update campaign
- **DELETE /api/v1/campaigns/:id** - Delete campaign
- **POST /api/v1/campaigns/:id/start** - Start campaign execution
- **POST /api/v1/campaigns/:id/pause** - Pause campaign
- **POST /api/v1/campaigns/:id/resume** - Resume campaign
- **POST /api/v1/campaigns/:id/stop** - Stop campaign
- **GET /api/v1/campaigns/:id/status** - Get campaign status and metrics
- **GET /api/v1/campaigns/:id/calls** - Get campaign call history

### Frontend Components

#### Pages
- **Campaigns.tsx** - Main campaign management interface
- **Contacts.tsx** - Contact and CSV file management

#### Dialogs
- **CampaignSettingsDialog.tsx** - Campaign creation and configuration
- **CampaignDetailsDialog.tsx** - Campaign monitoring and control
- **TermsOfUseDialog.tsx** - Legal compliance acceptance
- **DeleteCampaignDialog.tsx** - Campaign deletion confirmation

#### API Services
- **fetchCampaigns.ts** - Retrieve user campaigns
- **saveCampaign.ts** - Create new campaigns
- **startCampaign.ts** - Start campaign execution
- **pauseCampaign.ts** - Pause running campaigns
- **resumeCampaign.ts** - Resume paused campaigns
- **stopCampaign.ts** - Stop campaign execution
- **deleteCampaign.ts** - Delete campaigns
- **getCampaignStatus.ts** - Get campaign metrics
- **getCampaignCalls.ts** - Get call history

## Usage

### Creating a Campaign

1. **Navigate to Campaigns** - Click "Campaigns" in the sidebar
2. **Accept Terms** - Review and accept the terms of use
3. **Configure Settings**:
   - Enter campaign name
   - Select AI assistant
   - Choose contact source (CSV file or contact list)
   - Set daily call limit
   - Configure calling schedule
   - Write campaign prompt with placeholders
4. **Create Campaign** - Click "Finish" to save

### Managing Campaigns

1. **View Campaigns** - See all campaigns in the main table
2. **Monitor Status** - Check execution status and progress
3. **Control Execution** - Start, pause, resume, or stop campaigns
4. **View Details** - Click campaign name for detailed monitoring
5. **Delete Campaigns** - Remove campaigns when no longer needed

### Campaign Monitoring

1. **Overview Tab** - Campaign status, progress, and basic metrics
2. **Calls Tab** - Detailed call history with outcomes
3. **Metrics Tab** - Performance statistics and analytics
4. **Real-time Updates** - Auto-refreshing data every 10 seconds

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
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_WS_URL=your_ws_url

# Campaign Engine
ENABLE_CAMPAIGN_ENGINE=true
NODE_ENV=development
```

### Database Setup

Run the SQL migration to create campaign tables:

```sql
-- Run create-outbound-calls-schema.sql
-- This creates all necessary tables for campaign management
```

## Campaign Prompt Placeholders

Use these placeholders in your campaign prompts for personalization:

- `{name}` - Contact's name
- `{email}` - Contact's email address
- `{phone}` - Contact's phone number
- `{company}` - Contact's company (if available)

Example prompt:
```
Hello {name}, this is Sarah from our sales team. I'm calling about your recent inquiry regarding our services. I noticed you provided {email} as your contact information. Is this a good time to discuss how we can help your business grow?
```

## Campaign Statuses

### Execution Status
- **idle** - Campaign created but not started
- **running** - Campaign actively making calls
- **paused** - Campaign temporarily stopped
- **completed** - Campaign finished all contacts
- **error** - Campaign encountered an error

### Call Status
- **pending** - Call queued for execution
- **calling** - Call in progress
- **answered** - Call was answered
- **completed** - Call finished successfully
- **failed** - Call failed to connect
- **no_answer** - Call was not answered
- **busy** - Line was busy
- **cancelled** - Call was cancelled

### Call Outcomes
- **interested** - Contact showed interest
- **not_interested** - Contact declined
- **callback** - Contact requested callback
- **do_not_call** - Contact requested to be removed
- **voicemail** - Left voicemail
- **wrong_number** - Invalid phone number

## Troubleshooting

### Common Issues

1. **Campaign Not Starting**
   - Check that assistant has an active phone number
   - Verify Twilio credentials are configured
   - Ensure LiveKit is properly set up
   - Check campaign execution engine logs

2. **No Calls Being Made**
   - Verify contact source has valid contacts
   - Check calling schedule configuration
   - Ensure daily cap hasn't been reached
   - Verify phone numbers are in correct format

3. **Calls Failing**
   - Check Twilio account balance
   - Verify phone number format (E.164)
   - Check for invalid or blocked numbers
   - Review Twilio error logs

4. **AI Agent Not Responding**
   - Verify LiveKit configuration
   - Check assistant prompt configuration
   - Ensure LiveKit agent is running
   - Review LiveKit logs

### Debugging

1. **Enable Debug Logging**
   ```bash
   DEBUG=campaigns,outbound,livekit npm run dev
   ```

2. **Check Campaign Status**
   - Use the campaign details dialog
   - Monitor real-time metrics
   - Review call history

3. **Verify Integration**
   - Test Twilio connectivity
   - Check LiveKit agent status
   - Verify database connections

## Security and Compliance

### Data Protection
- All contact data is encrypted at rest
- Campaign data is isolated per user
- Call recordings are securely stored
- Personal information is protected

### Legal Compliance
- Terms of use acceptance required
- Do-not-call list management
- Calling hour restrictions
- Opt-out request handling
- Data retention policies

### Best Practices
- Always obtain proper consent
- Respect calling hours
- Implement call frequency limits
- Provide clear identification
- Honor opt-out requests immediately

## Performance Optimization

### Campaign Execution
- Batch processing for efficiency
- Smart scheduling to avoid peak hours
- Automatic retry logic for failed calls
- Queue management for high volume

### Database Optimization
- Indexed queries for fast lookups
- Efficient data structures
- Regular cleanup of old data
- Optimized joins for related data

### Monitoring
- Real-time performance metrics
- Error tracking and alerting
- Resource usage monitoring
- Campaign success analytics

## API Reference

### Campaign Endpoints

#### Create Campaign
```http
POST /api/v1/campaigns
Content-Type: application/json

{
  "name": "Q4 Sales Campaign",
  "assistantId": "assistant-123",
  "contactSource": "csv_file",
  "csvFileId": "csv-456",
  "dailyCap": 100,
  "callingDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "startHour": 9,
  "endHour": 17,
  "campaignPrompt": "Hello {name}, this is a sales call..."
}
```

#### Start Campaign
```http
POST /api/v1/campaigns/{campaignId}/start
```

#### Get Campaign Status
```http
GET /api/v1/campaigns/{campaignId}/status
```

#### Get Campaign Calls
```http
GET /api/v1/campaigns/{campaignId}/calls?limit=50&offset=0
```

## Support

For technical support or questions about campaign management:

1. Check the troubleshooting section above
2. Review the API documentation
3. Check server logs for error details
4. Contact support with specific error messages

## Changelog

### Version 1.0.0
- Initial campaign management implementation
- CSV file upload and processing
- Contact list management
- Campaign creation and configuration
- Real-time campaign monitoring
- AI agent integration
- Twilio outbound calling
- LiveKit integration
- Comprehensive API endpoints
- Frontend management interface

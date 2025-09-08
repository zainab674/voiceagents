# Call Recording Setup for Voiceagents

This document explains how call recording is enabled and managed in the voiceagents project using Twilio Elastic SIP Trunks.

## Overview

The recording functionality has been integrated into the voiceagents project to automatically record all calls made through Twilio Elastic SIP Trunks. Recording is enabled at the trunk level, ensuring all calls are captured without requiring individual API calls.

## Features

- **Trunk-Level Recording**: All calls through the trunk are automatically recorded
- **Dual Channel Recording**: Records both inbound and outbound audio separately
- **From Ringing**: Recording starts from the ringing state, not just when answered
- **Automatic Processing**: No manual intervention needed - recording happens automatically
- **Database Integration**: Recording information is stored in Supabase
- **Webhook Integration**: Recording status updates are handled via webhooks

## How It Works

### 1. Trunk Creation with Recording

When a new Elastic SIP Trunk is created via `createMainTrunkForUser()`, recording is automatically enabled:

```javascript
// Enable recording from ringing after trunk creation
const response = await fetch(`https://trunking.twilio.com/v1/Trunks/${trunkSid}/Recording`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'Mode=record-from-ringing&Trim=do-not-trim'
});
```

### 2. Recording Configuration

- **Mode**: `record-from-ringing` - Recording starts from the ringing state
- **Trim**: `do-not-trim` - Don't trim silence from the recording
- **Channels**: Dual channel recording (both inbound and outbound audio)
- **Track**: Both tracks are recorded

### 3. Database Schema

Recording information is stored in the `call_history` table with these additional columns:

```sql
-- Recording fields
call_sid TEXT                    -- Twilio Call SID
recording_sid TEXT               -- Twilio Recording SID
recording_url TEXT               -- URL to access the recording file
recording_status TEXT            -- Status (in-progress, completed, failed)
recording_duration INTEGER       -- Duration in seconds
recording_channels INTEGER       -- Number of audio channels
recording_start_time TIMESTAMP   -- When recording started
recording_source TEXT            -- Source of the recording
recording_track TEXT             -- Audio track type
```

## API Endpoints

### Recording Management

- `POST /api/v1/twilio/recording/enable` - Enable recording on a trunk
- `GET /api/v1/twilio/recording/:callSid` - Get recording info for a call

### Recording Webhooks

- `POST /api/v1/recording/status` - Twilio recording status callback
- `GET /api/v1/recording/:callSid` - Get recording information
- `GET /api/v1/recording/health` - Health check

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Twilio credentials (required)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Database (required)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: Enable/disable recording
ENABLE_CALL_RECORDING=true
```

## Setup Instructions

### 1. Database Migration

Run the database migration to add recording fields:

```sql
-- Run the migration file
\i backend/database/add-recording-fields.sql
```

### 2. Environment Configuration

Ensure your environment variables are properly set, especially:
- Twilio credentials
- Supabase connection details

### 3. Webhook Configuration

Configure Twilio to send recording status callbacks to:
```
https://your-domain.com/api/v1/recording/status
```

## Usage Examples

### Enable Recording on Existing Trunk

```javascript
const response = await fetch('/api/v1/twilio/recording/enable', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    trunkSid: 'your-trunk-sid'
  })
});
```

### Get Recording Information

```javascript
const response = await fetch('/api/v1/twilio/recording/CA1234567890abcdef', {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});
const data = await response.json();
console.log(data.recording);
```

## Troubleshooting

### Recording Not Working

1. **Check trunk configuration**: Verify the trunk has recording enabled
2. **Verify credentials**: Ensure Twilio credentials are correct
3. **Check webhook**: Verify recording status callback URL is configured
4. **Check logs**: Look for recording-related error messages

### Call SID Not Found

1. **Verify trunk setup**: Ensure the trunk is properly configured
2. **Check participant attributes**: Verify Call SID is being passed correctly
3. **Check Twilio account**: Ensure the trunk is using the correct account

### Database Issues

1. **Run migration**: Ensure the recording fields have been added to the database
2. **Check permissions**: Verify Supabase service role has proper permissions
3. **Check connection**: Ensure database connection is working

## File Structure

```
backend/
├── services/
│   ├── twilioMainTrunkService.js    # Main trunk creation with recording
│   └── recordingService.js          # Recording webhook handlers
├── controllers/
│   └── twilioController.js          # Recording API controllers
├── routes/
│   └── twilioRoute.js               # Recording API routes
├── database/
│   └── add-recording-fields.sql     # Database migration
└── RECORDING_SETUP.md               # This documentation
```

## Integration with sass-livekit

This implementation follows the same pattern as the sass-livekit project, ensuring consistency across both projects. The recording functionality is designed to be:

- **Automatic**: No manual intervention required
- **Robust**: Handles errors gracefully
- **Scalable**: Works with multiple trunks and users
- **Maintainable**: Clean, well-documented code

## Support

For issues or questions about the recording functionality, check:

1. This documentation
2. Twilio Console for trunk configuration
3. Application logs for error messages
4. Database for recording status updates


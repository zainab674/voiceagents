# Essential Call History Saving in VoiceAgents

## Overview

The voiceagents project now has essential call history saving functionality. This simplified system saves basic call data including transcriptions and metadata to the enhanced `calls` table.

## What's Been Implemented

### 1. Essential Database Schema
- **File**: `backend/database/enhance-calls-table-essential.sql`
- **Purpose**: Adds only essential fields to the existing `calls` table
- **New Fields**:
  - `call_sid` - Twilio Call SID for tracking
  - `transcription` - JSON array of conversation transcription
  - `participant_identity` - Identity of the participant
  - `room_name` - LiveKit room name
  - `recording_sid`, `recording_url`, `recording_status`, `recording_duration` - Recording fields

### 2. Call History Service
- **File**: `backend/services/call-history-service.js`
- **Purpose**: Core service for saving and retrieving call history
- **Features**:
  - Save essential call data
  - Process transcriptions
  - Extract phone numbers and call SIDs

### 3. LiveKit Call Saver
- **File**: `backend/services/livekit-call-saver.js`
- **Purpose**: Specialized service for LiveKit session data
- **Features**:
  - Convert LiveKit sessions to call data
  - Extract metadata from participants and rooms
  - Handle session history processing

### 4. Essential API Endpoints
- **File**: `backend/controllers/callController.js`
- **New Endpoint**: `POST /api/calls/essential-history`
- **Purpose**: Save essential call data via API

## How to Use

### 1. Database Setup
Run the essential database migration:
```sql
-- Run this SQL file in your Supabase database
-- backend/database/enhance-calls-table-essential.sql
```

### 2. API Usage
Save essential call history via API:
```javascript
const response = await fetch('/api/calls/essential-history', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    call_id: 'room-+1234567890',
    assistant_id: 'assistant-123',
    user_id: 'user-456',
    phone_number: '+1234567890',
    participant_identity: 'John Doe',
    start_time: '2024-01-15T10:00:00Z',
    end_time: '2024-01-15T10:05:00Z',
    call_duration: 300,
    call_status: 'completed',
    transcription: [
      { role: 'user', content: 'Hello, I need help' },
      { role: 'assistant', content: 'Hi! How can I assist you?' }
    ],
    call_sid: 'CA1234567890abcdef',
    room_name: 'room-+1234567890',
    outcome: 'completed',
    success: true,
    notes: 'Call completed successfully',
    recording_sid: 'RE1234567890abcdef',
    recording_url: 'https://api.twilio.com/...',
    recording_status: 'completed',
    recording_duration: 300
  })
});
```

### 3. Programmatic Usage
Use the services directly in your code:
```javascript
import CallHistoryService from './services/call-history-service.js';
import LiveKitCallSaver from './services/livekit-call-saver.js';

// Initialize services
const callHistoryService = new CallHistoryService();
const livekitCallSaver = new LiveKitCallSaver();

// Save call data
const result = await callHistoryService.saveCallHistory(callData);

// Process LiveKit session
const sessionData = livekitCallSaver.createSessionData(room, participant, sessionHistory);
const saveResult = await livekitCallSaver.saveCallFromLiveKitSession(sessionData, assistantConfig);
```

## Data Structure

### Essential Call Data Object
```javascript
{
  // Basic call info
  call_id: 'string',
  assistant_id: 'string',
  user_id: 'string',
  phone_number: 'string',
  participant_identity: 'string',
  start_time: 'ISO string',
  end_time: 'ISO string',
  call_duration: 'number (seconds)',
  call_status: 'string',
  outcome: 'string',
  success: 'boolean',
  notes: 'string',
  
  // Transcription
  transcription: [
    { role: 'user|assistant', content: 'string' }
  ],
  
  // Twilio data
  call_sid: 'string',
  
  // Additional metadata
  room_name: 'string',
  
  // Recording data (optional)
  recording_sid: 'string',
  recording_url: 'string',
  recording_status: 'string',
  recording_duration: 'number'
}
```

## Benefits

- **Simple Call Tracking**: Basic call data with transcriptions
- **Recording Integration**: Link calls with Twilio recordings
- **LiveKit Integration**: Works seamlessly with LiveKit sessions
- **Minimal Database Changes**: Only adds essential fields
- **Easy to Use**: Simple API and service interfaces

## Migration Required

You need to run the migration because your current `calls` table is missing these essential fields:
- `call_sid` - For Twilio integration
- `transcription` - For conversation history
- `participant_identity` - For participant tracking
- `room_name` - For LiveKit room tracking
- Recording fields - For recording integration

The migration is safe and only adds new columns with default values.

## Next Steps

1. Run the database migration: `backend/database/enhance-calls-table-essential.sql`
2. Set up environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
3. Use the API endpoint or services directly
4. Monitor call history saving in your logs

The voiceagents project now has essential call history saving! 🚀

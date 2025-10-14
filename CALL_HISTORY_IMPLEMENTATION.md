# Comprehensive Call History Saving in VoiceAgents

## Overview

The voiceagents project now has comprehensive call history saving functionality similar to sass-livekit. This system saves all call data including transcriptions, AI analysis, and metadata to the enhanced `calls` table.

## What's Been Implemented

### 1. Enhanced Database Schema
- **File**: `backend/database/enhance-calls-table-comprehensive.sql`
- **Purpose**: Adds comprehensive fields to the existing `calls` table
- **New Fields**:
  - AI Analysis: `call_summary`, `success_evaluation`, `structured_data`, `call_outcome`
  - Outcome Analysis: `outcome_confidence`, `outcome_reasoning`, `outcome_key_points`, `outcome_sentiment`
  - Follow-up: `follow_up_required`, `follow_up_notes`
  - Additional: `participant_identity`, `room_name`, `assistant_config`
  - Recording: `recording_sid`, `recording_url`, `recording_status`, etc.

### 2. Call History Service
- **File**: `backend/services/call-history-service.js`
- **Purpose**: Core service for saving and retrieving call history
- **Features**:
  - Save comprehensive call data
  - Update existing calls
  - Retrieve call history with pagination
  - Process transcriptions
  - Extract phone numbers and call SIDs

### 3. LiveKit Call Saver
- **File**: `backend/services/livekit-call-saver.js`
- **Purpose**: Specialized service for LiveKit session data
- **Features**:
  - Convert LiveKit sessions to call data
  - Extract metadata from participants and rooms
  - Create analysis results objects
  - Handle session history processing

### 4. Enhanced API Endpoints
- **File**: `backend/controllers/callController.js`
- **New Endpoint**: `POST /api/calls/comprehensive-history`
- **Purpose**: Save comprehensive call data via API
- **File**: `backend/routes/callRoute.js`
- **Route**: Added comprehensive history saving route

## How to Use

### 1. Database Setup
Run the database migration to add the new fields:
```sql
-- Run this SQL file in your Supabase database
-- backend/database/enhance-calls-table-comprehensive.sql
```

### 2. API Usage
Save comprehensive call history via API:
```javascript
const response = await fetch('/api/calls/comprehensive-history', {
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
    call_summary: 'Customer called for support assistance',
    success_evaluation: 'SUCCESS',
    structured_data: {
      name: 'John Doe',
      issue_type: 'support_request'
    },
    call_outcome: 'resolved',
    outcome_confidence: 0.85,
    outcome_reasoning: 'Issue was successfully resolved',
    outcome_key_points: ['Customer inquiry', 'Issue resolved'],
    outcome_sentiment: 'positive',
    follow_up_required: false,
    follow_up_notes: null,
    room_name: 'room-+1234567890',
    assistant_config: {
      id: 'assistant-123',
      name: 'Support Assistant'
    }
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
const analysisResults = livekitCallSaver.createAnalysisResults(aiAnalysis, structuredData, outcomeAnalysis);
const saveResult = await livekitCallSaver.saveCallFromLiveKitSession(sessionData, assistantConfig, analysisResults);
```

## Data Structure

### Call Data Object
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
  
  // Transcription
  transcription: [
    { role: 'user|assistant', content: 'string' }
  ],
  
  // Twilio data
  call_sid: 'string',
  
  // AI Analysis
  call_summary: 'string',
  success_evaluation: 'SUCCESS|FAILED',
  structured_data: { /* extracted data */ },
  
  // Outcome Analysis
  call_outcome: 'string',
  outcome_confidence: 'number (0.0-1.0)',
  outcome_reasoning: 'string',
  outcome_key_points: ['string'],
  outcome_sentiment: 'positive|neutral|negative',
  follow_up_required: 'boolean',
  follow_up_notes: 'string',
  
  // Additional metadata
  room_name: 'string',
  assistant_config: { /* assistant config */ },
  
  // Recording data
  recording_sid: 'string',
  recording_url: 'string',
  recording_status: 'string',
  recording_duration: 'number',
  recording_channels: 'number',
  recording_start_time: 'ISO string',
  recording_source: 'string',
  recording_track: 'string'
}
```

## Integration with LiveKit

The system is designed to integrate seamlessly with LiveKit sessions:

1. **Session Processing**: Extract data from LiveKit room and participant objects
2. **Transcription Handling**: Process session history into structured format
3. **Metadata Extraction**: Extract call SIDs, phone numbers, and other metadata
4. **AI Analysis**: Combine AI analysis results with call data
5. **Database Storage**: Save everything to the enhanced calls table

## Benefits

- **Complete Call Tracking**: Every call is saved with full context
- **AI Analysis Storage**: Store AI-generated summaries and outcomes
- **Structured Data**: Extract and store structured information from calls
- **Recording Integration**: Link calls with Twilio recordings
- **Follow-up Management**: Track calls requiring follow-up actions
- **Analytics Ready**: Rich data for analytics and reporting

## Testing

The system has been tested for:
- ✅ Service instantiation
- ✅ Transcription processing
- ✅ Phone number extraction
- ✅ Call SID extraction
- ✅ Session data creation
- ✅ Analysis results creation

## Next Steps

1. Run the database migration
2. Set up environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
3. Integrate with your LiveKit implementation
4. Use the API endpoints or services directly
5. Monitor call history saving in your logs

The voiceagents project now has the same comprehensive call history saving capabilities as sass-livekit! 🚀

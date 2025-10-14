-- Enhance calls table with essential call history fields only
-- This migration adds only the basic fields needed for call tracking

-- Add essential call tracking fields
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS call_sid TEXT,
ADD COLUMN IF NOT EXISTS transcription JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS participant_identity TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS room_name TEXT DEFAULT NULL;

-- Add recording-related fields (if you want recording support)
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS recording_sid TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_status TEXT,
ADD COLUMN IF NOT EXISTS recording_duration INTEGER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid) WHERE call_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_transcription ON calls USING GIN (transcription) WHERE transcription IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_participant_identity ON calls(participant_identity) WHERE participant_identity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_room_name ON calls(room_name) WHERE room_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_recording_sid ON calls(recording_sid) WHERE recording_sid IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN calls.call_sid IS 'Twilio Call SID for tracking calls';
COMMENT ON COLUMN calls.transcription IS 'JSON array of conversation transcription with role and content fields';
COMMENT ON COLUMN calls.participant_identity IS 'Identity of the participant (name or phone number)';
COMMENT ON COLUMN calls.room_name IS 'LiveKit room name for the call';
COMMENT ON COLUMN calls.recording_sid IS 'Twilio Recording SID for tracking recordings';
COMMENT ON COLUMN calls.recording_url IS 'URL to access the recording file';
COMMENT ON COLUMN calls.recording_status IS 'Status of the recording (in-progress, completed, failed)';
COMMENT ON COLUMN calls.recording_duration IS 'Duration of the recording in seconds';

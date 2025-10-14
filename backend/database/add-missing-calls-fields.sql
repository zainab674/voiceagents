-- Add only the missing essential fields to calls table
-- This migration adds only the fields that are actually missing

-- Add missing essential fields
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS participant_identity TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS room_name TEXT DEFAULT NULL;

-- Add recording fields (optional - only if you want recording support)
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS recording_sid TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_status TEXT,
ADD COLUMN IF NOT EXISTS recording_duration INTEGER;

-- Create indexes for better performance (only for new fields)
CREATE INDEX IF NOT EXISTS idx_calls_participant_identity ON calls(participant_identity) WHERE participant_identity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_room_name ON calls(room_name) WHERE room_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_recording_sid ON calls(recording_sid) WHERE recording_sid IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN calls.participant_identity IS 'Identity of the participant (name or phone number)';
COMMENT ON COLUMN calls.room_name IS 'LiveKit room name for the call';
COMMENT ON COLUMN calls.recording_sid IS 'Twilio Recording SID for tracking recordings';
COMMENT ON COLUMN calls.recording_url IS 'URL to access the recording file';
COMMENT ON COLUMN calls.recording_status IS 'Status of the recording (in-progress, completed, failed)';
COMMENT ON COLUMN calls.recording_duration IS 'Duration of the recording in seconds';

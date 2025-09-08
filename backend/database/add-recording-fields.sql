-- Add recording-related columns to call_history table
-- This migration adds fields to store Twilio recording information

-- Add recording fields to call_history table
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS call_sid TEXT;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_sid TEXT;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_status TEXT;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_duration INTEGER;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_channels INTEGER;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_start_time TIMESTAMP;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_source TEXT;
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_track TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_history_call_sid ON call_history(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_history_recording_sid ON call_history(recording_sid);
CREATE INDEX IF NOT EXISTS idx_call_history_recording_status ON call_history(recording_status);

-- Add comments for documentation
COMMENT ON COLUMN call_history.call_sid IS 'Twilio Call SID for tracking calls';
COMMENT ON COLUMN call_history.recording_sid IS 'Twilio Recording SID for tracking recordings';
COMMENT ON COLUMN call_history.recording_url IS 'URL to access the recording file';
COMMENT ON COLUMN call_history.recording_status IS 'Status of the recording (in-progress, completed, failed)';
COMMENT ON COLUMN call_history.recording_duration IS 'Duration of the recording in seconds';
COMMENT ON COLUMN call_history.recording_channels IS 'Number of audio channels in the recording';
COMMENT ON COLUMN call_history.recording_start_time IS 'When the recording started';
COMMENT ON COLUMN call_history.recording_source IS 'Source of the recording (DialVerb, Conference, etc.)';
COMMENT ON COLUMN call_history.recording_track IS 'Audio track type (inbound, outbound, both)';


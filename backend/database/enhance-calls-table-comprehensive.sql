-- Enhance calls table with comprehensive call history fields
-- This migration adds all the fields needed for comprehensive call tracking like sass-livekit

-- Add comprehensive call analysis fields
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS call_summary TEXT,
ADD COLUMN IF NOT EXISTS success_evaluation TEXT,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS call_outcome TEXT,
ADD COLUMN IF NOT EXISTS outcome_confidence DECIMAL(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS outcome_reasoning TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS outcome_key_points JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS outcome_sentiment VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS participant_identity TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS room_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS assistant_config JSONB DEFAULT '{}'::jsonb;

-- Add recording-related fields
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS recording_sid TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_status TEXT,
ADD COLUMN IF NOT EXISTS recording_duration INTEGER,
ADD COLUMN IF NOT EXISTS recording_channels INTEGER,
ADD COLUMN IF NOT EXISTS recording_start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS recording_source TEXT,
ADD COLUMN IF NOT EXISTS recording_track TEXT;

-- Add constraints for outcome_confidence (0.0 to 1.0)
ALTER TABLE calls 
ADD CONSTRAINT check_outcome_confidence 
CHECK (outcome_confidence IS NULL OR (outcome_confidence >= 0.0 AND outcome_confidence <= 1.0));

-- Add constraint for outcome_sentiment
ALTER TABLE calls 
ADD CONSTRAINT check_outcome_sentiment 
CHECK (outcome_sentiment IS NULL OR outcome_sentiment IN ('positive', 'neutral', 'negative'));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_call_summary ON calls(call_summary) WHERE call_summary IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_success_evaluation ON calls(success_evaluation) WHERE success_evaluation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_structured_data ON calls USING GIN(structured_data) WHERE structured_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_call_outcome ON calls(call_outcome) WHERE call_outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_outcome_confidence ON calls(outcome_confidence) WHERE outcome_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_outcome_sentiment ON calls(outcome_sentiment) WHERE outcome_sentiment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_follow_up_required ON calls(follow_up_required) WHERE follow_up_required = TRUE;
CREATE INDEX IF NOT EXISTS idx_calls_participant_identity ON calls(participant_identity) WHERE participant_identity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_room_name ON calls(room_name) WHERE room_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_recording_sid ON calls(recording_sid) WHERE recording_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_recording_status ON calls(recording_status) WHERE recording_status IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN calls.call_summary IS 'AI-generated summary of the call conversation';
COMMENT ON COLUMN calls.success_evaluation IS 'AI evaluation of call success/failure (SUCCESS/FAILED)';
COMMENT ON COLUMN calls.structured_data IS 'Structured data extracted from the call (JSONB)';
COMMENT ON COLUMN calls.call_outcome IS 'AI-determined call outcome (booked_appointment, completed, not_qualified, etc.)';
COMMENT ON COLUMN calls.outcome_confidence IS 'Confidence score (0.0-1.0) from AI analysis of call outcome';
COMMENT ON COLUMN calls.outcome_reasoning IS 'AI-generated reasoning for the determined call outcome';
COMMENT ON COLUMN calls.outcome_key_points IS 'Key points extracted from the call conversation';
COMMENT ON COLUMN calls.outcome_sentiment IS 'Overall sentiment of the call (positive, neutral, negative)';
COMMENT ON COLUMN calls.follow_up_required IS 'Whether follow-up action is required based on AI analysis';
COMMENT ON COLUMN calls.follow_up_notes IS 'AI-generated notes for follow-up actions';
COMMENT ON COLUMN calls.participant_identity IS 'Identity of the participant (name or phone number)';
COMMENT ON COLUMN calls.room_name IS 'LiveKit room name for the call';
COMMENT ON COLUMN calls.assistant_config IS 'Assistant configuration used for the call';
COMMENT ON COLUMN calls.recording_sid IS 'Twilio Recording SID for tracking recordings';
COMMENT ON COLUMN calls.recording_url IS 'URL to access the recording file';
COMMENT ON COLUMN calls.recording_status IS 'Status of the recording (in-progress, completed, failed)';
COMMENT ON COLUMN calls.recording_duration IS 'Duration of the recording in seconds';
COMMENT ON COLUMN calls.recording_channels IS 'Number of audio channels in the recording';
COMMENT ON COLUMN calls.recording_start_time IS 'When the recording started';
COMMENT ON COLUMN calls.recording_source IS 'Source of the recording (DialVerb, Conference, etc.)';
COMMENT ON COLUMN calls.recording_track IS 'Audio track type (inbound, outbound, both)';

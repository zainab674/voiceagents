-- Add transcription field to calls table
-- This migration adds transcription support to match sass-livekit functionality

-- Add transcription field to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription JSONB;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_transcription ON calls USING GIN (transcription);

-- Add comments for documentation
COMMENT ON COLUMN calls.transcription IS 'JSON array of conversation transcription with role and content fields';

-- Example transcription structure:
-- [
--   {"role": "user", "content": "Hello, I'm interested in your services"},
--   {"role": "assistant", "content": "Thank you for calling! How can I help you today?"}
-- ]


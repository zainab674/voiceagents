-- Add call_sid field to calls table to store Twilio CallSid
-- This migration adds the call_sid field to link calls with Twilio recording data

-- Add call_sid field to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_sid TEXT;

-- Add index for better performance when looking up by call_sid
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);

-- Add comment for documentation
COMMENT ON COLUMN calls.call_sid IS 'Twilio Call SID for tracking calls and linking with recording data';

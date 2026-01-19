-- Add call_type column to calls table
-- This migration adds the call_type field to track whether calls are inbound, outbound, or web

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS call_type VARCHAR(20) DEFAULT 'inbound';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_call_type ON calls(call_type) WHERE call_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN calls.call_type IS 'Type of call: inbound, outbound, or web';

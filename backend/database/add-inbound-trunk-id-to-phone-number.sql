-- Add inbound_trunk_id column to phone_number table
-- This allows storing LiveKit inbound trunk IDs for phone numbers

-- Add inbound_trunk_id column if it doesn't exist
ALTER TABLE phone_number 
ADD COLUMN IF NOT EXISTS inbound_trunk_id TEXT;

-- Create index for faster queries on inbound_trunk_id
CREATE INDEX IF NOT EXISTS idx_phone_number_inbound_trunk_id 
ON phone_number (inbound_trunk_id);

-- Add comment for documentation
COMMENT ON COLUMN phone_number.inbound_trunk_id IS 'LiveKit inbound trunk ID for receiving calls on this number';

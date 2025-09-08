-- Add trunk_sid column to phone_number table for main trunk strategy
-- This allows storing which Twilio trunk each phone number is attached to

-- Add trunk_sid column if it doesn't exist
ALTER TABLE phone_number 
ADD COLUMN IF NOT EXISTS trunk_sid TEXT;

-- Create index for faster queries on trunk_sid
CREATE INDEX IF NOT EXISTS idx_phone_number_trunk_sid 
ON phone_number (trunk_sid);

-- Add comment for documentation
COMMENT ON COLUMN phone_number.trunk_sid IS 'Twilio Elastic SIP Trunk SID for this phone number (per-number strategy)';

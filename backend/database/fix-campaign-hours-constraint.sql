-- Fix campaign hours constraint to allow 24 for midnight
-- This allows end_hour to be 24 (which represents midnight/end of day)

-- Update the constraint to allow 24 for end_hour
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_end_hour_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_end_hour_check CHECK (end_hour >= 0 AND end_hour <= 24);

-- Add comment explaining the constraint
COMMENT ON COLUMN campaigns.end_hour IS 'End hour for calling (0-23 for normal hours, 24 for midnight/end of day)';

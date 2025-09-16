-- Add last_daily_reset column to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMPTZ;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_last_daily_reset ON campaigns(last_daily_reset);

-- Add comment
COMMENT ON COLUMN campaigns.last_daily_reset IS 'Timestamp of the last daily cap reset';


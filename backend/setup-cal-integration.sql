-- Add Cal.com integration fields to agents table
-- Run this script to update existing database schema

-- Add Cal.com integration columns
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS cal_api_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS cal_event_type_slug VARCHAR(100),
ADD COLUMN IF NOT EXISTS cal_event_type_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS cal_timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS cal_enabled BOOLEAN DEFAULT false;

-- Create index for Cal.com enabled agents
CREATE INDEX IF NOT EXISTS idx_agents_cal_enabled ON agents(cal_enabled);

-- Update existing agents to have cal_enabled = false
UPDATE agents SET cal_enabled = false WHERE cal_enabled IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN agents.cal_api_key IS 'Cal.com API key for calendar integration';
COMMENT ON COLUMN agents.cal_event_type_slug IS 'Slug of the Cal.com event type for this agent';
COMMENT ON COLUMN agents.cal_event_type_id IS 'Internal Cal.com event type ID';
COMMENT ON COLUMN agents.cal_timezone IS 'Timezone for appointment scheduling';
COMMENT ON COLUMN agents.cal_enabled IS 'Whether Cal.com integration is enabled for this agent';

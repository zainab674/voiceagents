-- Add sms_prompt field to agents table
-- This migration adds a dedicated SMS prompt field for agents

-- Add the sms_prompt column to the agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS sms_prompt TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN agents.sms_prompt IS 'Dedicated prompt for SMS conversations, separate from the main voice call prompt';

-- Update existing agents to have a default SMS prompt if they don't have one
-- This will use the existing prompt as the SMS prompt for backward compatibility
UPDATE agents 
SET sms_prompt = prompt 
WHERE sms_prompt IS NULL OR sms_prompt = '';

-- Create an index on sms_prompt for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_agents_sms_prompt ON agents(sms_prompt) WHERE sms_prompt IS NOT NULL;

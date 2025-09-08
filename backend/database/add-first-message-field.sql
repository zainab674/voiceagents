-- Add first_message field to agents table
-- This migration adds the first_message field to existing agents tables

-- Add the first_message column if it doesn't exist
ALTER TABLE agents ADD COLUMN IF NOT EXISTS first_message TEXT;

-- Add a comment to document the field
COMMENT ON COLUMN agents.first_message IS 'Custom greeting message for the agent to use when starting calls';

-- Update any existing agents with a default first message if they don't have one
UPDATE agents 
SET first_message = 'Hi! Thanks for calling. How can I help you today?'
WHERE first_message IS NULL OR first_message = '';

-- Optional: Set specific first messages for existing agents based on their names
-- You can customize this based on your needs
UPDATE agents 
SET first_message = 'Hi! You''ve reached ' || name || '. Thanks for calling. How can I help you today?'
WHERE first_message IS NULL OR first_message = ''
AND name IS NOT NULL;





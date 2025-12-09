-- Add Unipile configuration fields to users for tenant-specific social integration
ALTER TABLE users
ADD COLUMN IF NOT EXISTS unipile_dsn TEXT,
ADD COLUMN IF NOT EXISTS unipile_access_token TEXT;




-- Adds landing category support for whitelabel tenants
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS landing_category TEXT;

CREATE INDEX IF NOT EXISTS idx_users_landing_category ON users(landing_category);


-- VoiceAgents - Whitelabel & tenant support
-- Adds tenant metadata to users table and introduces plan configuration storage

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS slug_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS tenant VARCHAR(255) DEFAULT 'main',
    ADD COLUMN IF NOT EXISTS is_whitelabel BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS minutes_limit INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS minutes_used INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS website_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS logo TEXT,
    ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS meta_description TEXT,
    ADD COLUMN IF NOT EXISTS live_demo_agent_id UUID,
    ADD COLUMN IF NOT EXISTS live_demo_phone_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS policy_text TEXT;

CREATE INDEX IF NOT EXISTS idx_users_slug_name ON users(slug_name);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant);

-- Plan configurations allow each tenant to define custom plan pricing & limits
-- tenant IS NULL for main tenant plans, tenant = slug_name for whitelabel tenant plans
CREATE TABLE IF NOT EXISTS plan_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    minutes_limit INTEGER DEFAULT 0,
    features JSONB DEFAULT '[]'::jsonb,
    tenant TEXT, -- NULL for main tenant plans, slug_name for whitelabel tenant plans
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists (must be done before creating indexes)
ALTER TABLE plan_configs
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Drop existing unique constraint if it exists
ALTER TABLE plan_configs DROP CONSTRAINT IF EXISTS plan_configs_plan_key_tenant_key;
ALTER TABLE plan_configs DROP CONSTRAINT IF EXISTS plan_configs_plan_key_key;

-- Create unique constraint: plan_key must be unique per tenant (NULL tenant = main)
-- This allows same plan_key for different tenants
CREATE UNIQUE INDEX IF NOT EXISTS plan_configs_tenant_plan_key_unique 
ON plan_configs(COALESCE(tenant, 'main'), plan_key);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_plan_configs_tenant ON plan_configs(tenant) WHERE tenant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_configs_tenant_key ON plan_configs(tenant, plan_key) WHERE tenant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_configs_key ON plan_configs(plan_key);
CREATE INDEX IF NOT EXISTS idx_plan_configs_active ON plan_configs(is_active);

CREATE OR REPLACE FUNCTION update_plan_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_plan_configs_updated_at ON plan_configs;

CREATE TRIGGER update_plan_configs_updated_at
    BEFORE UPDATE ON plan_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_plan_configs_updated_at();


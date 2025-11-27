-- Update plan_configs table to match sass-livekit pattern
-- Adds is_active and display_order columns if they don't exist
-- Updates unique constraint to use COALESCE pattern

-- Add is_active column if it doesn't exist
ALTER TABLE plan_configs
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add display_order column if it doesn't exist
ALTER TABLE plan_configs
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Drop existing unique constraints if they exist
ALTER TABLE plan_configs DROP CONSTRAINT IF EXISTS plan_configs_plan_key_tenant_key;
ALTER TABLE plan_configs DROP CONSTRAINT IF EXISTS plan_configs_plan_key_key;

-- Create unique constraint: plan_key must be unique per tenant (NULL tenant = main)
-- This allows same plan_key for different tenants
DROP INDEX IF EXISTS plan_configs_tenant_plan_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS plan_configs_tenant_plan_key_unique 
ON plan_configs(COALESCE(tenant, 'main'), plan_key);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_plan_configs_tenant ON plan_configs(tenant) WHERE tenant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_configs_tenant_key ON plan_configs(tenant, plan_key) WHERE tenant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_configs_key ON plan_configs(plan_key);
CREATE INDEX IF NOT EXISTS idx_plan_configs_active ON plan_configs(is_active);

-- Add comments
COMMENT ON COLUMN plan_configs.tenant IS 'Tenant identifier - NULL for main tenant plans, slug_name for whitelabel tenant plans';
COMMENT ON COLUMN plan_configs.minutes_limit IS 'Minutes allocated per month. 0 means unlimited';
COMMENT ON COLUMN plan_configs.features IS 'JSON array of feature strings';
COMMENT ON COLUMN plan_configs.is_active IS 'Whether this plan is active and available for selection';
COMMENT ON COLUMN plan_configs.display_order IS 'Order in which plans should be displayed (ascending)';



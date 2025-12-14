-- Add Stripe IDs to plan_configs table
ALTER TABLE plan_configs
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

COMMENT ON COLUMN plan_configs.stripe_price_id IS 'Stripe Price ID for the plan subscription';
COMMENT ON COLUMN plan_configs.stripe_product_id IS 'Stripe Product ID (optional, for reference)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_plan_configs_stripe_price ON plan_configs(stripe_price_id);

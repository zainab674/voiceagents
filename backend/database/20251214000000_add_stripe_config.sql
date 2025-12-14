-- Add Stripe configuration fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;

-- Add comments for clarity
COMMENT ON COLUMN users.stripe_secret_key IS 'Stripe Secret Key for the admin/tenant';
COMMENT ON COLUMN users.stripe_publishable_key IS 'Stripe Publishable Key for the admin/tenant';

-- User-specific Instagram / Meta credentials
CREATE TABLE IF NOT EXISTS user_instagram_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_type TEXT NOT NULL DEFAULT 'facebook_login', -- 'facebook_login' | 'instagram_login'
    app_id TEXT NOT NULL,
    app_secret TEXT NOT NULL,
    verify_token TEXT NOT NULL,
    page_id TEXT,
    instagram_business_id TEXT,
    long_lived_access_token TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_instagram_credentials_user_id
    ON user_instagram_credentials(user_id);

-- Simple trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_user_instagram_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_user_instagram_credentials_updated_at
BEFORE UPDATE ON user_instagram_credentials
FOR EACH ROW
EXECUTE FUNCTION update_user_instagram_credentials_updated_at();




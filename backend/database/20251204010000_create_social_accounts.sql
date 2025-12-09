-- Social account connections via Unipile
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- e.g. WHATSAPP, INSTAGRAM, LINKEDIN, TELEGRAM, EMAIL_GOOGLE, etc.
    unipile_account_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | OK | CREDENTIALS | DISCONNECTED | ERROR
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id
    ON social_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_social_accounts_unipile_account_id
    ON social_accounts(unipile_account_id);

-- Mapping from social accounts to agents
CREATE TABLE IF NOT EXISTS social_account_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    routing_rules JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT social_account_agents_social_account_unique UNIQUE (social_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_account_agents_social_account_id
    ON social_account_agents(social_account_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_social_accounts_updated_at
BEFORE UPDATE ON social_accounts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_updated_at();

CREATE TRIGGER trg_update_social_account_agents_updated_at
BEFORE UPDATE ON social_account_agents
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_updated_at();




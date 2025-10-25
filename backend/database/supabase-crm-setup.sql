-- CRM Integration Database Setup
-- Run these queries in Supabase SQL Editor

-- 1. Create user CRM app credentials table
CREATE TABLE IF NOT EXISTS user_crm_app_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_platform VARCHAR(50) NOT NULL CHECK (crm_platform IN ('hubspot', 'zoho')),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one active app credential per platform per user
  UNIQUE(user_id, crm_platform, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Create indexes for user CRM app credentials
CREATE INDEX IF NOT EXISTS idx_user_crm_app_credentials_user_id ON user_crm_app_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_crm_app_credentials_platform ON user_crm_app_credentials(crm_platform);
CREATE INDEX IF NOT EXISTS idx_user_crm_app_credentials_active ON user_crm_app_credentials(user_id, crm_platform, is_active) WHERE is_active = true;

-- 3. Enable RLS on user CRM app credentials
ALTER TABLE user_crm_app_credentials ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for user CRM app credentials
CREATE POLICY "Users can view their own CRM app credentials" ON user_crm_app_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CRM app credentials" ON user_crm_app_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CRM app credentials" ON user_crm_app_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CRM app credentials" ON user_crm_app_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Create function to update updated_at timestamp for CRM app credentials
CREATE OR REPLACE FUNCTION update_user_crm_app_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for updated_at on CRM app credentials
CREATE TRIGGER trigger_update_user_crm_app_credentials_updated_at
  BEFORE UPDATE ON user_crm_app_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_crm_app_credentials_updated_at();

-- 7. Create user CRM credentials table (for OAuth tokens)
CREATE TABLE IF NOT EXISTS user_crm_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_platform VARCHAR(50) NOT NULL CHECK (crm_platform IN ('hubspot', 'zoho')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT, -- OAuth scopes granted
  account_id TEXT, -- HubSpot portal ID or Zoho organization ID
  account_name TEXT, -- Human-readable account name
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one active credential per platform per user
  UNIQUE(user_id, crm_platform, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- 8. Create indexes for user CRM credentials
CREATE INDEX IF NOT EXISTS idx_user_crm_credentials_user_id ON user_crm_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_crm_credentials_platform ON user_crm_credentials(crm_platform);
CREATE INDEX IF NOT EXISTS idx_user_crm_credentials_active ON user_crm_credentials(user_id, crm_platform, is_active) WHERE is_active = true;

-- 9. Enable RLS on user CRM credentials
ALTER TABLE user_crm_credentials ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for user CRM credentials
CREATE POLICY "Users can view their own CRM credentials" ON user_crm_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CRM credentials" ON user_crm_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CRM credentials" ON user_crm_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CRM credentials" ON user_crm_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- 11. Create function to update updated_at timestamp for CRM credentials
CREATE OR REPLACE FUNCTION update_user_crm_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create trigger for updated_at on CRM credentials
CREATE TRIGGER trigger_update_user_crm_credentials_updated_at
  BEFORE UPDATE ON user_crm_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_crm_credentials_updated_at();

-- 13. Create CRM contacts table for synced contact data
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crm_platform VARCHAR(50) NOT NULL CHECK (crm_platform IN ('hubspot', 'zoho')),
  crm_contact_id TEXT NOT NULL, -- External CRM contact ID
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  company VARCHAR(255),
  job_title VARCHAR(255),
  raw_data JSONB, -- Store full CRM response for flexibility
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique per platform per user
  UNIQUE(user_id, crm_platform, crm_contact_id)
);

-- 14. Create indexes for CRM contacts
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_platform ON crm_contacts(crm_platform);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_last_synced ON crm_contacts(last_synced_at);

-- 15. Enable RLS on CRM contacts
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

-- 16. Create RLS policies for CRM contacts
CREATE POLICY "Users can view their own CRM contacts" ON crm_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CRM contacts" ON crm_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CRM contacts" ON crm_contacts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CRM contacts" ON crm_contacts
  FOR DELETE USING (auth.uid() = user_id);

-- 17. Create OAuth state table for secure OAuth flow
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('hubspot', 'zoho')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Create indexes for OAuth states
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- 19. Enable RLS on OAuth states
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- 20. Create RLS policies for OAuth states
CREATE POLICY "Users can view their own OAuth states" ON oauth_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth states" ON oauth_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth states" ON oauth_states
  FOR DELETE USING (auth.uid() = user_id);

-- 21. Create function to clean up expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 22. Add comments for documentation
COMMENT ON TABLE user_crm_app_credentials IS 'Stores user-provided CRM app credentials (client_id, client_secret) for OAuth';
COMMENT ON TABLE user_crm_credentials IS 'Stores OAuth tokens after successful CRM authentication';
COMMENT ON TABLE crm_contacts IS 'Stores synced contact data from CRM platforms';
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth state parameters during authentication flow';

COMMENT ON COLUMN user_crm_app_credentials.client_id IS 'CRM app client ID provided by user';
COMMENT ON COLUMN user_crm_app_credentials.client_secret IS 'CRM app client secret provided by user';
COMMENT ON COLUMN user_crm_app_credentials.redirect_uri IS 'OAuth redirect URI configured by user';

-- 23. Verify tables were created successfully
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'user_crm_app_credentials',
    'user_crm_credentials', 
    'crm_contacts',
    'oauth_states'
  )
ORDER BY table_name;

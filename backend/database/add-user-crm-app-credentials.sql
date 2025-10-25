-- Add user-provided CRM app credentials table
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_crm_app_credentials_user_id ON user_crm_app_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_crm_app_credentials_platform ON user_crm_app_credentials(crm_platform);
CREATE INDEX IF NOT EXISTS idx_user_crm_app_credentials_active ON user_crm_app_credentials(user_id, crm_platform, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_crm_app_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own CRM app credentials" ON user_crm_app_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CRM app credentials" ON user_crm_app_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CRM app credentials" ON user_crm_app_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CRM app credentials" ON user_crm_app_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_crm_app_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_user_crm_app_credentials_updated_at
  BEFORE UPDATE ON user_crm_app_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_user_crm_app_credentials_updated_at();

-- Add comments for documentation
COMMENT ON TABLE user_crm_app_credentials IS 'Stores user-provided CRM app credentials (client_id, client_secret) for OAuth';
COMMENT ON COLUMN user_crm_app_credentials.client_id IS 'CRM app client ID provided by user';
COMMENT ON COLUMN user_crm_app_credentials.client_secret IS 'CRM app client secret provided by user';
COMMENT ON COLUMN user_crm_app_credentials.redirect_uri IS 'OAuth redirect URI configured by user';


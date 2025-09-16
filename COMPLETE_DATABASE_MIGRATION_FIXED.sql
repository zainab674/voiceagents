-- ========================================
-- COMPLETE DATABASE MIGRATION FOR VOICEAGENTS (FIXED)
-- ========================================
-- Run this in your Supabase SQL Editor to set up the complete schema

-- (Optional) ensure gen_random_uuid() is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- 1. ADD SIP CONFIGURATION TO TWILIO CREDENTIALS
-- ========================================

ALTER TABLE user_twilio_credentials 
  ADD COLUMN IF NOT EXISTS domain_name TEXT,
  ADD COLUMN IF NOT EXISTS domain_prefix TEXT,
  ADD COLUMN IF NOT EXISTS credential_list_sid TEXT,
  ADD COLUMN IF NOT EXISTS sip_username TEXT,
  ADD COLUMN IF NOT EXISTS sip_password TEXT;

CREATE INDEX IF NOT EXISTS idx_user_twilio_credentials_domain_name 
  ON user_twilio_credentials(domain_name);

CREATE INDEX IF NOT EXISTS idx_user_twilio_credentials_credential_list_sid 
  ON user_twilio_credentials(credential_list_sid);

COMMENT ON COLUMN user_twilio_credentials.domain_name IS 'Full Twilio termination domain name (e.g., user-123-456.pstn.twilio.com)';
COMMENT ON COLUMN user_twilio_credentials.domain_prefix IS 'Domain prefix without .pstn.twilio.com suffix';
COMMENT ON COLUMN user_twilio_credentials.credential_list_sid IS 'Twilio credential list SID for SIP authentication';
COMMENT ON COLUMN user_twilio_credentials.sip_username IS 'SIP authentication username';
COMMENT ON COLUMN user_twilio_credentials.sip_password IS 'SIP authentication password';

-- ========================================
-- 2. CREATE SMS MESSAGES TABLE (FIXED - NO CONVERSATIONS REFERENCE)
-- ========================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_sid TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  num_segments TEXT,
  price TEXT,
  price_unit TEXT,
  date_created TIMESTAMPTZ NOT NULL,
  date_sent TIMESTAMPTZ,
  date_updated TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_user_id ON sms_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from_number ON sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_date_created ON sms_messages(date_created);
CREATE INDEX IF NOT EXISTS idx_sms_messages_message_sid ON sms_messages(message_sid);

-- shared updated_at() trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER update_sms_messages_updated_at 
  BEFORE UPDATE ON sms_messages 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own SMS messages" ON sms_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SMS messages" ON sms_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SMS messages" ON sms_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SMS messages" ON sms_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- 3. ADD CALL SID TO CALLS TABLE
-- ========================================

ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_sid TEXT;
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
COMMENT ON COLUMN calls.call_sid IS 'Twilio Call SID for tracking calls and linking with recording data';

-- ========================================
-- 4. ADD RECORDING FIELDS TO CALL_HISTORY (IF TABLE EXISTS)
-- ========================================

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'call_history'
  ) THEN
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS call_sid TEXT;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_sid TEXT;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_url TEXT;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_status TEXT;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_duration INTEGER;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_channels INTEGER;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_start_time TIMESTAMP;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_source TEXT;
    ALTER TABLE call_history ADD COLUMN IF NOT EXISTS recording_track TEXT;

    CREATE INDEX IF NOT EXISTS idx_call_history_call_sid ON call_history(call_sid);
    CREATE INDEX IF NOT EXISTS idx_call_history_recording_sid ON call_history(recording_sid);
    CREATE INDEX IF NOT EXISTS idx_call_history_recording_status ON call_history(recording_status);

    COMMENT ON COLUMN call_history.call_sid IS 'Twilio Call SID for tracking calls';
    COMMENT ON COLUMN call_history.recording_sid IS 'Twilio Recording SID for tracking recordings';
    COMMENT ON COLUMN call_history.recording_url IS 'URL to access the recording file';
    COMMENT ON COLUMN call_history.recording_status IS 'Status of the recording (in-progress, completed, failed)';
    COMMENT ON COLUMN call_history.recording_duration IS 'Duration of the recording in seconds';
    COMMENT ON COLUMN call_history.recording_channels IS 'Number of audio channels in the recording';
    COMMENT ON COLUMN call_history.recording_start_time IS 'When the recording started';
    COMMENT ON COLUMN call_history.recording_source IS 'Source of the recording (DialVerb, Conference, etc.)';
    COMMENT ON COLUMN call_history.recording_track IS 'Audio track type (inbound, outbound, both)';
  END IF;
END
$do$;

-- ========================================
-- 5. ADD TRANSCRIPTION FIELD TO CALLS
-- ========================================

ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription JSONB;
CREATE INDEX IF NOT EXISTS idx_calls_transcription ON calls USING GIN (transcription);
COMMENT ON COLUMN calls.transcription IS 'JSON array of conversation transcription with role and content fields';

-- ========================================
-- 6. CREATE OUTBOUND CALLS SCHEMA
-- ========================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  assistant_id UUID NOT NULL,
  assistant_name VARCHAR(255),
  contact_source VARCHAR(50) NOT NULL CHECK (contact_source IN ('contact_list', 'csv_file')),
  contact_list_id UUID,
  csv_file_id UUID,
  daily_cap INTEGER NOT NULL DEFAULT 100,
  calling_days TEXT[] NOT NULL DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  start_hour INTEGER NOT NULL DEFAULT 9 CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INTEGER NOT NULL DEFAULT 17 CHECK (end_hour BETWEEN 0 AND 23),
  campaign_prompt TEXT,
  execution_status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (execution_status IN ('idle','running','paused','completed','error')),
  next_call_at TIMESTAMPTZ,
  current_daily_calls INTEGER NOT NULL DEFAULT 0,
  total_calls_made INTEGER NOT NULL DEFAULT 0,
  total_calls_answered INTEGER NOT NULL DEFAULT 0,
  dials INTEGER NOT NULL DEFAULT 0,
  pickups INTEGER NOT NULL DEFAULT 0,
  interested INTEGER NOT NULL DEFAULT 0,
  not_interested INTEGER NOT NULL DEFAULT 0,
  callback INTEGER NOT NULL DEFAULT 0,
  do_not_call INTEGER NOT NULL DEFAULT 0,
  total_usage INTEGER NOT NULL DEFAULT 0,
  last_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID,
  phone_number VARCHAR(20) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  call_sid VARCHAR(100),
  room_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','calling','answered','completed','failed','no_answer','busy')),
  outcome VARCHAR(50) CHECK (outcome IN ('interested','not_interested','callback','do_not_call','voicemail','wrong_number')),
  call_duration INTEGER DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  notes TEXT,
  do_not_call BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS csv_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  processed_contacts INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','processing','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS csv_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csv_file_id UUID NOT NULL REFERENCES csv_files(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  do_not_call BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add outbound trunk fields to phone_number table (if table exists)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'phone_number'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'phone_number' AND column_name = 'outbound_trunk_id'
    ) THEN
      ALTER TABLE phone_number ADD COLUMN outbound_trunk_id TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'phone_number' AND column_name = 'outbound_trunk_name'
    ) THEN
      ALTER TABLE phone_number ADD COLUMN outbound_trunk_name TEXT;
    END IF;
  END IF;
END
$do$;

-- These comments are safe even if columns were just added above
COMMENT ON COLUMN phone_number.outbound_trunk_id IS 'LiveKit outbound trunk ID for making calls from this number';
COMMENT ON COLUMN phone_number.outbound_trunk_name IS 'LiveKit outbound trunk name for making calls from this number';

-- ========================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_assistant_id ON campaigns(assistant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_execution_status ON campaigns(execution_status);

CREATE INDEX IF NOT EXISTS idx_campaign_calls_campaign_id ON campaign_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_status ON campaign_calls(status);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_phone_number ON campaign_calls(phone_number);

CREATE INDEX IF NOT EXISTS idx_contact_lists_user_id ON contact_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_list_id ON contacts(contact_list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);

CREATE INDEX IF NOT EXISTS idx_csv_files_user_id ON csv_files(user_id);
CREATE INDEX IF NOT EXISTS idx_csv_contacts_csv_file_id ON csv_contacts(csv_file_id);
CREATE INDEX IF NOT EXISTS idx_csv_contacts_phone_number ON csv_contacts(phone_number);

-- ========================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_contacts ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 9. CREATE RLS POLICIES
-- ========================================

-- Campaigns
CREATE POLICY  "Users can view their own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY  "Users can insert their own campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY  "Users can update their own campaigns" ON campaigns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY  "Users can delete their own campaigns" ON campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- Campaign calls
CREATE POLICY  "Users can view campaign calls for their campaigns" ON campaign_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_calls.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );
CREATE POLICY  "Users can insert campaign calls for their campaigns" ON campaign_calls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_calls.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );
CREATE POLICY  "Users can update campaign calls for their campaigns" ON campaign_calls
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_calls.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );

-- Contact lists
CREATE POLICY  "Users can view their own contact lists" ON contact_lists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY  "Users can insert their own contact lists" ON contact_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY  "Users can update their own contact lists" ON contact_lists
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY  "Users can delete their own contact lists" ON contact_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Contacts
CREATE POLICY  "Users can view contacts for their contact lists" ON contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contact_lists
      WHERE contact_lists.id = contacts.contact_list_id
        AND contact_lists.user_id = auth.uid()
    )
  );
CREATE POLICY  "Users can insert contacts for their contact lists" ON contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM contact_lists
      WHERE contact_lists.id = contacts.contact_list_id
        AND contact_lists.user_id = auth.uid()
    )
  );
CREATE POLICY  "Users can update contacts for their contact lists" ON contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM contact_lists
      WHERE contact_lists.id = contacts.contact_list_id
        AND contact_lists.user_id = auth.uid()
    )
  );
CREATE POLICY  "Users can delete contacts for their contact lists" ON contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM contact_lists
      WHERE contact_lists.id = contacts.contact_list_id
        AND contact_lists.user_id = auth.uid()
    )
  );

-- CSV files
CREATE POLICY  "Users can view their own csv files" ON csv_files
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY  "Users can insert their own csv files" ON csv_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY  "Users can update their own csv files" ON csv_files
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY  "Users can delete their own csv files" ON csv_files
  FOR DELETE USING (auth.uid() = user_id);

-- CSV contacts
CREATE POLICY  "Users can view csv contacts for their csv files" ON csv_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM csv_files
      WHERE csv_files.id = csv_contacts.csv_file_id
        AND csv_files.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert csv contacts for their csv files" ON csv_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM csv_files
      WHERE csv_files.id = csv_contacts.csv_file_id
        AND csv_files.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update csv contacts for their csv files" ON csv_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM csv_files
      WHERE csv_files.id = csv_contacts.csv_file_id
        AND csv_files.user_id = auth.uid()
    )
  );
CREATE POLICY  "Users can delete csv contacts for their csv files" ON csv_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM csv_files
      WHERE csv_files.id = csv_contacts.csv_file_id
        AND csv_files.user_id = auth.uid()
    )
  );

-- ========================================
-- 10. VERIFICATION QUERIES
-- ========================================

-- Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'user_twilio_credentials','sms_messages','calls','call_history',
    'campaigns','campaign_calls','contact_lists','contacts',
    'csv_files','csv_contacts','phone_number'
  )
ORDER BY table_name;

-- Verify SIP configuration columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'user_twilio_credentials' 
  AND column_name IN ('domain_name','domain_prefix','credential_list_sid','sip_username','sip_password')
ORDER BY column_name;

-- Verify SMS messages table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'sms_messages'
ORDER BY column_name;

-- Verify campaigns table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'campaigns'
ORDER BY column_name;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('sms_messages','campaigns','campaign_calls','contact_lists','contacts','csv_files','csv_contacts')
ORDER BY tablename;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

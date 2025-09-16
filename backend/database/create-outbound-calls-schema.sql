-- Create outbound calls schema for voiceagents
-- This creates the necessary tables for campaign and outbound call management

-- Create campaigns table
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
    calling_days TEXT[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    start_hour INTEGER NOT NULL DEFAULT 9 CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INTEGER NOT NULL DEFAULT 17 CHECK (end_hour >= 0 AND end_hour <= 23),
    campaign_prompt TEXT,
    execution_status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (execution_status IN ('idle', 'running', 'paused', 'completed', 'error')),
    next_call_at TIMESTAMP WITH TIME ZONE,
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
    last_execution_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaign_calls table
CREATE TABLE IF NOT EXISTS campaign_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID,
    phone_number VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    call_sid VARCHAR(100),
    room_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'answered', 'completed', 'failed', 'no_answer', 'busy')),
    outcome VARCHAR(50) CHECK (outcome IN ('interested', 'not_interested', 'callback', 'do_not_call', 'voicemail', 'wrong_number')),
    call_duration INTEGER DEFAULT 0,
    notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contact_lists table
CREATE TABLE IF NOT EXISTS contact_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    company VARCHAR(255),
    notes TEXT,
    do_not_call BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create csv_files table
CREATE TABLE IF NOT EXISTS csv_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    total_contacts INTEGER NOT NULL DEFAULT 0,
    processed_contacts INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create csv_contacts table
CREATE TABLE IF NOT EXISTS csv_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    csv_file_id UUID NOT NULL REFERENCES csv_files(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    company VARCHAR(255),
    do_not_call BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add outbound trunk fields to phone_number table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phone_number' AND column_name = 'outbound_trunk_id') THEN
        ALTER TABLE phone_number ADD COLUMN outbound_trunk_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phone_number' AND column_name = 'outbound_trunk_name') THEN
        ALTER TABLE phone_number ADD COLUMN outbound_trunk_name TEXT;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN phone_number.outbound_trunk_id IS 'LiveKit outbound trunk ID for making calls from this number';
COMMENT ON COLUMN phone_number.outbound_trunk_name IS 'LiveKit outbound trunk name for making calls from this number';

-- Create indexes for better performance
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

-- Enable Row Level Security (RLS)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own campaigns" ON campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns" ON campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" ON campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" ON campaigns
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view campaign calls for their campaigns" ON campaign_calls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE campaigns.id = campaign_calls.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert campaign calls for their campaigns" ON campaign_calls
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE campaigns.id = campaign_calls.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update campaign calls for their campaigns" ON campaign_calls
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE campaigns.id = campaign_calls.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own contact lists" ON contact_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact lists" ON contact_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact lists" ON contact_lists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact lists" ON contact_lists
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view contacts for their contact lists" ON contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM contact_lists 
            WHERE contact_lists.id = contacts.contact_list_id 
            AND contact_lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert contacts for their contact lists" ON contacts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM contact_lists 
            WHERE contact_lists.id = contacts.contact_list_id 
            AND contact_lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update contacts for their contact lists" ON contacts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM contact_lists 
            WHERE contact_lists.id = contacts.contact_list_id 
            AND contact_lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete contacts for their contact lists" ON contacts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM contact_lists 
            WHERE contact_lists.id = contacts.contact_list_id 
            AND contact_lists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own csv files" ON csv_files
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own csv files" ON csv_files
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own csv files" ON csv_files
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own csv files" ON csv_files
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view csv contacts for their csv files" ON csv_contacts
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

CREATE POLICY "Users can delete csv contacts for their csv files" ON csv_contacts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM csv_files 
            WHERE csv_files.id = csv_contacts.csv_file_id 
            AND csv_files.user_id = auth.uid()
        )
    );

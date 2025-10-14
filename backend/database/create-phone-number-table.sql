-- Create phone_number table for voiceagents project
-- This table maps phone numbers to agents for call routing

CREATE TABLE IF NOT EXISTS phone_number (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_sid TEXT NOT NULL UNIQUE,
    number TEXT NOT NULL UNIQUE,
    label TEXT,
    inbound_assistant_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    webhook_status TEXT DEFAULT 'configured',
    status TEXT DEFAULT 'active',
    trunk_sid TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_phone_number_user_id ON phone_number(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_number ON phone_number(number);
CREATE INDEX IF NOT EXISTS idx_phone_number_phone_sid ON phone_number(phone_sid);
CREATE INDEX IF NOT EXISTS idx_phone_number_trunk_sid ON phone_number(trunk_sid);
CREATE INDEX IF NOT EXISTS idx_phone_number_assistant_id ON phone_number(inbound_assistant_id);

-- Enable Row Level Security
ALTER TABLE phone_number ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own phone numbers" ON phone_number
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone numbers" ON phone_number
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone numbers" ON phone_number
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phone numbers" ON phone_number
    FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_phone_number_updated_at
BEFORE UPDATE ON phone_number
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE phone_number IS 'Maps phone numbers to agents for call routing';
COMMENT ON COLUMN phone_number.phone_sid IS 'Twilio phone number SID';
COMMENT ON COLUMN phone_number.number IS 'Phone number in E.164 format';
COMMENT ON COLUMN phone_number.inbound_assistant_id IS 'Agent that handles inbound calls to this number';
COMMENT ON COLUMN phone_number.webhook_status IS 'Status of webhook configuration (configured, pending, failed)';
COMMENT ON COLUMN phone_number.status IS 'Status of the phone number (active, inactive, suspended)';
COMMENT ON COLUMN phone_number.trunk_sid IS 'Twilio trunk SID for outbound calls';
COMMENT ON COLUMN phone_number.user_id IS 'User who owns this phone number';

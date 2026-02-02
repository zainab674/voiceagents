-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Register update_updated_at_column trigger for system_settings
CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only authenticated users can view settings (public ones)
-- Note: Secrets will be filtered by the backend API
CREATE POLICY "Anyone can view public settings" ON system_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify settings
CREATE POLICY "Admins can manage settings" ON system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Seed initial records if they don't exist
INSERT INTO system_settings (key, value, description, is_secret)
VALUES 
    ('openai_api_key', '', 'OpenAI API Key for LLM and TTS', true),
    ('deepgram_api_key', '', 'Deepgram API Key for STT and TTS', true),
    ('cartesia_api_key', '', 'Cartesia API Key for TTS', true),
    ('openai_llm_model', 'gpt-4o-mini', 'OpenAI model to use for the AI agent', false)
ON CONFLICT (key) DO NOTHING;

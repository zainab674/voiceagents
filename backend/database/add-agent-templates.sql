-- Create table to store reusable assistant templates managed by admins
CREATE TABLE IF NOT EXISTS agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    sms_prompt TEXT,
    first_message TEXT,
    cal_event_type_slug VARCHAR(100),
    cal_event_type_id VARCHAR(100),
    cal_timezone VARCHAR(50) DEFAULT 'UTC',
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT TRUE,
    category TEXT,
    tags TEXT[],
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS idx_agent_templates_created_by ON agent_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_templates_is_public ON agent_templates(is_public);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION update_agent_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_templates_updated_at
    BEFORE UPDATE ON agent_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_templates_updated_at();

-- Enable RLS so users can consume templates while only owners (admins) manage them
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can read templates; adjust if you want stricter access
CREATE POLICY IF NOT EXISTS "Templates are readable by everyone" ON agent_templates
    FOR SELECT USING (true);

-- Only the template creator can insert/update/delete under their auth context
CREATE POLICY IF NOT EXISTS "Template creators can insert" ON agent_templates
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY IF NOT EXISTS "Template creators can update" ON agent_templates
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY IF NOT EXISTS "Template creators can delete" ON agent_templates
    FOR DELETE USING (auth.uid() = created_by);

-- Link agents back to the template they were created from
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agents_template_id ON agents(template_id);

COMMENT ON COLUMN agents.template_id IS 'Reference to the agent template used to create this assistant.';


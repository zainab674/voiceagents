
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addStructuredPromptField() {
    try {
        console.log('Adding structured_prompt field to agents and agent_templates tables...');

        const { error } = await supabase.rpc('exec_sql', {
            sql: `
        -- Add structured_prompt to agents table
        ALTER TABLE public.agents 
        ADD COLUMN IF NOT EXISTS structured_prompt JSONB;

        COMMENT ON COLUMN public.agents.structured_prompt IS 'Stores business variables for the auto-generated prompt';

        -- Add structured_prompt to agent_templates table
        ALTER TABLE public.agent_templates 
        ADD COLUMN IF NOT EXISTS structured_prompt JSONB;

        COMMENT ON COLUMN public.agent_templates.structured_prompt IS 'Stores business variables for the templates auto-generated prompt';
      `
        });

        if (error) {
            console.error('Error adding structured_prompt fields:', error);
        } else {
            console.log('✅ Structured prompt fields added successfully!');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

addStructuredPromptField();

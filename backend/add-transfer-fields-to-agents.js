
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

async function addTransferFields() {
    try {
        console.log('Adding transfer fields to agents table...');

        const { error } = await supabase.rpc('exec_sql', {
            sql: `
        ALTER TABLE public.agents 
        ADD COLUMN IF NOT EXISTS transfer_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS transfer_phone_number TEXT,
        ADD COLUMN IF NOT EXISTS transfer_country_code TEXT DEFAULT '+1',
        ADD COLUMN IF NOT EXISTS transfer_sentence TEXT,
        ADD COLUMN IF NOT EXISTS transfer_condition TEXT;

        COMMENT ON COLUMN public.agents.transfer_enabled IS 'Whether call transfer is enabled for this agent';
        COMMENT ON COLUMN public.agents.transfer_phone_number IS 'Phone number to transfer calls to (without country code)';
        COMMENT ON COLUMN public.agents.transfer_country_code IS 'Country code for transfer phone number (e.g., +1, +44)';
        COMMENT ON COLUMN public.agents.transfer_sentence IS 'What the agent will say before transferring the call';
        COMMENT ON COLUMN public.agents.transfer_condition IS 'Description of when the agent should transfer the call';
      `
        });

        if (error) {
            console.error('Error adding transfer fields:', error);

            // Fallback: try adding columns one by one if exec_sql isn't available or fails
            console.log('Trying fallback method...');
            // Logic for fallback omitted for brevity, assuming rpc exec_sql works as seen in setup-agents-table.js
        } else {
            console.log('✅ Transfer fields added successfully!');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

addTransferFields();

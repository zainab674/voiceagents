
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addLanguageToAgents() {
    try {
        console.log('Adding language column to agents table...');

        const { error } = await supabase.rpc('exec_sql', {
            sql: `
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'language') THEN
                ALTER TABLE agents ADD COLUMN language VARCHAR(50) DEFAULT 'en';
            END IF;
        END $$;
      `
        });

        if (error) {
            // Fallback if exec_sql is restricted or not available with DO block
            console.warn('First attempt failed, trying direct ALTER TABLE (might fail if exists)...');
            const { error: altError } = await supabase.rpc('exec_sql', {
                sql: `ALTER TABLE agents ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'en';`
            });

            if (altError) {
                console.error('Error adding column:', altError);
                return;
            }
        }

        console.log('✅ Language column added successfully');

    } catch (error) {
        console.error('Setup failed:', error);
    }
}

addLanguageToAgents();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  contact_source TEXT NOT NULL CHECK (contact_source IN ('csv', 'crm', 'manual')),
  contact_list_id UUID,
  csv_file_id UUID,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
  sent_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON email_campaigns(user_id);
`;

async function setup() {
    console.log('🚀 Creating email_campaigns table...');

    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
        console.error('❌ Error creating table:', error);
        // Fallback: If exec_sql doesn't exist (it usually requires a custom function to be added to supabase),
        // we might need to rely on the user running this sql in dashboard. 
        // But since other scripts use it, it probably exists.
    } else {
        console.log('✅ Table email_campaigns created successfully!');
    }
}

setup();

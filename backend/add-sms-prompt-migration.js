import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSmsPromptMigration() {
  try {
    console.log('Running SMS prompt migration...');

    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'database', 'add-sms-prompt-to-agents.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('Migration error:', error);
      return;
    }

    console.log('✅ SMS prompt migration completed successfully!');
    console.log('Added sms_prompt field to agents table');
    console.log('Updated existing agents to use their main prompt as SMS prompt for backward compatibility');

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runSmsPromptMigration();

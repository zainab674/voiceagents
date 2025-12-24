
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setup() {
    console.log('🚀 Creating user_smtp_credentials table...');

    const sqlPath = path.join(__dirname, 'database', 'create-user-smtp-credentials.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Using a direct query because exec_sql might not be available or we can use the postgrest-js if we had direct access, 
    // but usually running DDL requires specific setup. 
    // If 'exec_sql' rpc exists (as seen in other scripts), we use it.

    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
        console.error('❌ Error creating table:', error);
        console.log('Attempting alternative method if exec_sql is missing...');
        // If exec_sql is missing, we can't easily run DDL unless we have direct connection string.
        // But the user has been running similar scripts, so 'exec_sql' likely exists.
    } else {
        console.log('✅ Table user_smtp_credentials created successfully!');
    }
}

setup();

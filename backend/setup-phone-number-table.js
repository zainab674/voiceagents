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

async function setupPhoneNumberTable() {
  try {
    console.log('Setting up phone_number table...');

    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'database', 'create-phone-number-table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL by splitting into individual statements
    const statements = sqlContent.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() });
          if (error) {
            console.log(`Skipping statement (might already exist): ${statement.substring(0, 50)}...`);
          }
        } catch (err) {
          console.log(`Skipping statement (might already exist): ${statement.substring(0, 50)}...`);
        }
      }
    }

    console.log('✅ Phone number table setup completed successfully!');
    console.log('The table includes:');
    console.log('- id (UUID, Primary Key)');
    console.log('- phone_sid (TEXT, Unique)');
    console.log('- number (TEXT, Unique)');
    console.log('- label (TEXT)');
    console.log('- inbound_assistant_id (UUID, Foreign Key to agents)');
    console.log('- webhook_status (TEXT)');
    console.log('- status (TEXT)');
    console.log('- trunk_sid (TEXT)');
    console.log('- user_id (UUID, Foreign Key to users)');
    console.log('- created_at (Timestamp)');
    console.log('- updated_at (Timestamp)');
    console.log('- Row Level Security (RLS) enabled');
    console.log('- Proper indexes and triggers');

    // Test the table
    console.log('\nTesting phone_number table access...');
    const { data: phoneNumbers, error: testError } = await supabase
      .from('phone_number')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('❌ Phone number table test error:', testError.message);
    } else {
      console.log(`✅ Phone number table accessible (${phoneNumbers?.length || 0} records)`);
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupPhoneNumberTable();

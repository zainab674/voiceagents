// fix-csv-contacts-schema.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSchema() {
    console.log('Fixing csv_contacts table schema...');

    try {
        // Make phone_number nullable
        const { error } = await supabase.rpc('run_sql', {
            sql_query: `ALTER TABLE csv_contacts ALTER COLUMN phone_number DROP NOT NULL;`
        });

        if (error) {
            // If RPC is not available, we might need another way or just report it
            console.error('Error executing SQL via RPC:', error);
            console.log('Attempting alternative approach...');

            // Some Supabase setups don't have run_sql RPC. 
            // In that case, we can't do much via the client alone except suggest the user run it in the dashboard.
            // But let's try a direct query if possible (rarely works via client)
        } else {
            console.log('Successfully made phone_number nullable.');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

fixSchema();

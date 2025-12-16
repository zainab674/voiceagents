import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

async function addStripeFields() {
    console.log('Adding Stripe fields to users table...');

    // Method 1: Try Direct Postgres Connection (Preferred for DDL)
    if (process.env.DATABASE_URL) {
        console.log('🔌 Found DATABASE_URL, attempting direct PostgreSQL connection...');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false } // Required for Supabase in many envs
        });

        try {
            const client = await pool.connect();
            try {
                console.log('✅ Connected to database via pg');

                await client.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
          ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;
        `);
                console.log('✅ Stripe fields added successfully via pg!');
                return;
            } finally {
                client.release();
                await pool.end();
            }
        } catch (err) {
            console.error('❌ Direct connection failed:', err.message);
            console.log('Falling back to Supabase RPC...');
        }
    } else {
        console.log('⚠️ No DATABASE_URL found. Skipping direct connection.');
    }

    // Method 2: Supabase RPC (Fallback)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Missing Supabase environment variables');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sql = `
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
    ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;
  `;

    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
        console.error('❌ Error executing SQL via RPC:', error);

        if (error.message.includes('function exec_sql') && error.message.includes('does not exist')) {
            console.error('\nCRITICAL ERROR: DDL execution failed.');
            console.error('The `exec_sql` function does not exist in your database, and no `DATABASE_URL` was provided.');
            console.error('You MUST run the following SQL manually in the Supabase SQL Editor:');
            console.log('\n' + sql + '\n');
        }
        return;
    }

    console.log('✅ Stripe fields added successfully via RPC!');
}

addStripeFields();

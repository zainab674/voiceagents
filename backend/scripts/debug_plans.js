import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPlans() {
    console.log('Checking plan_configs table...');

    // Get all plans
    const { data: plans, error } = await supabase
        .from('plan_configs')
        .select('*');

    if (error) {
        console.error('Error fetching plans:', error);
        return;
    }

    console.log(`Found ${plans.length} plans:`);
    if (plans.length === 0) {
        console.log("No plans found in the database. This is likely the issue.");
    } else {
        plans.forEach(p => {
            console.log(`- ID: ${p.id}, Name: ${p.name}, Tenant: "${p.tenant}", Active: ${p.is_active}`);
        });
    }
}

checkPlans();

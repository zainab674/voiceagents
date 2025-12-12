import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPlans() {
    console.log('--- Checking Plan Configs ---');

    // Check NULL tenant plans
    const { data: nullPlans } = await supabase
        .from('plan_configs')
        .select('id, name')
        .is('tenant', null);

    console.log(`NULL tenant plans: ${nullPlans?.length || 0}`);

    // Check 'main' tenant plans
    const { data: mainPlans } = await supabase
        .from('plan_configs')
        .select('id, name')
        .eq('tenant', 'main');

    console.log(`'main' tenant plans: ${mainPlans?.length || 0}`);

    // List all distinct tenants
    const { data: allPlans } = await supabase
        .from('plan_configs')
        .select('tenant, name');

    console.log('\nAll Plans Summary:');
    allPlans.forEach(p => {
        console.log(`- Tenant: [${p.tenant === null ? 'NULL' : p.tenant}], Name: ${p.name}`);
    });
}

checkPlans();

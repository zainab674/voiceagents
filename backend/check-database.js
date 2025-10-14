import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  try {
    console.log('🔍 Checking database contents...\n');

    // Check phone numbers
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_number')
      .select('*');

    if (phoneError) {
      console.error('❌ Error fetching phone numbers:', phoneError.message);
    } else {
      console.log(`📞 Phone Numbers (${phoneNumbers?.length || 0}):`);
      phoneNumbers?.forEach(phone => {
        console.log(`   - ${phone.number} → Assistant ID: ${phone.inbound_assistant_id || 'None'}`);
      });
    }

    console.log('');

    // Check agents
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, description');

    if (agentsError) {
      console.error('❌ Error fetching agents:', agentsError.message);
    } else {
      console.log(`🤖 Agents (${agents?.length || 0}):`);
      agents?.forEach(agent => {
        console.log(`   - ${agent.name} (ID: ${agent.id})`);
        console.log(`     Description: ${agent.description?.substring(0, 100)}...`);
      });
    }

    console.log('\n💡 To fix the issue:');
    console.log('1. Add phone number +12017656193 to phone_number table');
    console.log('2. Set inbound_assistant_id to one of the agent IDs above');
    console.log('3. Make sure the phone number format matches exactly: +12017656193');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

checkDatabase();

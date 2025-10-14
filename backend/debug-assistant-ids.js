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

async function debugAssistantIds() {
  try {
    console.log('🔍 Debugging Assistant IDs...\n');
    
    // 1. Get all assistants
    console.log('📋 All Assistants:');
    const { data: assistants, error: assistantsError } = await supabase
      .from('agents')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    
    if (assistantsError) {
      console.error('❌ Error fetching assistants:', assistantsError.message);
      return;
    }
    
    assistants.forEach(assistant => {
      console.log(`  🤖 ${assistant.name} (${assistant.id})`);
    });
    
    // 2. Get all campaigns
    console.log('\n📋 All Campaigns:');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, assistant_id, execution_status, created_at')
      .order('created_at', { ascending: false });
    
    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError.message);
      return;
    }
    
    campaigns.forEach(campaign => {
      console.log(`  📞 ${campaign.name} (${campaign.id})`);
      console.log(`     Assistant ID: ${campaign.assistant_id}`);
      console.log(`     Status: ${campaign.execution_status}`);
    });
    
    // 3. Get all phone numbers
    console.log('\n📋 All Phone Numbers:');
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_number')
      .select('id, number, inbound_assistant_id, status, created_at')
      .order('created_at', { ascending: false });
    
    if (phoneError) {
      console.error('❌ Error fetching phone numbers:', phoneError.message);
      return;
    }
    
    phoneNumbers.forEach(phone => {
      console.log(`  📱 ${phone.number} (${phone.id})`);
      console.log(`     Assistant ID: ${phone.inbound_assistant_id}`);
      console.log(`     Status: ${phone.status}`);
    });
    
    // 4. Find the mismatch
    console.log('\n🔍 Analysis:');
    const campaignAssistantId = '1389f36f-b736-42a9-8b6f-a374e66bf86a';
    const phoneAssistantId = '0f0ec914-62bc-43d1-a9cf-0b95b711c19d';
    
    console.log(`Campaign Assistant ID: ${campaignAssistantId}`);
    console.log(`Phone Number Assistant ID: ${phoneAssistantId}`);
    
    const campaignAssistant = assistants.find(a => a.id === campaignAssistantId);
    const phoneAssistant = assistants.find(a => a.id === phoneAssistantId);
    
    if (campaignAssistant) {
      console.log(`Campaign Assistant Name: ${campaignAssistant.name}`);
    } else {
      console.log('❌ Campaign Assistant NOT FOUND in agents table!');
    }
    
    if (phoneAssistant) {
      console.log(`Phone Assistant Name: ${phoneAssistant.name}`);
    } else {
      console.log('❌ Phone Assistant NOT FOUND in agents table!');
    }
    
    // 5. Check if campaign assistant exists
    const campaignAssistantExists = assistants.some(a => a.id === campaignAssistantId);
    const phoneAssistantExists = assistants.some(a => a.id === phoneAssistantId);
    
    console.log(`\n📊 Summary:`);
    console.log(`Campaign Assistant exists: ${campaignAssistantExists}`);
    console.log(`Phone Assistant exists: ${phoneAssistantExists}`);
    
    if (!campaignAssistantExists) {
      console.log('\n❌ PROBLEM FOUND: The campaign assistant does not exist in the agents table!');
      console.log('This means the campaign was created with an invalid assistant ID.');
    } else if (!phoneAssistantExists) {
      console.log('\n❌ PROBLEM FOUND: The phone assistant does not exist in the agents table!');
    } else {
      console.log('\n✅ Both assistants exist, but they are different IDs.');
      console.log('The campaign is using a different assistant than the one with the phone number.');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAssistantIds();

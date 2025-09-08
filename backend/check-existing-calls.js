// check-existing-calls.js
// Script to check existing calls in the database

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkExistingCalls() {
  try {
    console.log('🔄 Checking existing calls in the database...');

    // Get recent calls
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching calls:', error);
      return;
    }

    if (!calls || calls.length === 0) {
      console.log('📭 No calls found in the database');
      return;
    }

    console.log(`📊 Found ${calls.length} recent calls:`);
    calls.forEach((call, index) => {
      console.log(`\n${index + 1}. Call ID: ${call.id}`);
      console.log(`   Contact: ${call.contact_name} (${call.contact_phone})`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Outcome: ${call.outcome}`);
      console.log(`   Duration: ${call.duration_seconds}s`);
      console.log(`   Created: ${call.created_at}`);
      console.log(`   Has transcription: ${call.transcription ? 'Yes' : 'No'}`);
      if (call.transcription) {
        console.log(`   Transcription entries: ${call.transcription.length}`);
        console.log(`   Sample transcription:`, JSON.stringify(call.transcription[0], null, 2));
      }
      console.log(`   Notes: ${call.notes || 'None'}`);
    });

  } catch (error) {
    console.error('❌ Error checking existing calls:', error);
  }
}

// Run the script
checkExistingCalls();

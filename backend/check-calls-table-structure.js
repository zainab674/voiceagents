// check-calls-table-structure.js
import { createClient } from '@supabase/supabase-js';

async function checkCallsTableStructure() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔍 Checking current calls table structure...\n');

    // Get table information
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'calls')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (error) {
      console.error('❌ Error checking table structure:', error.message);
      return;
    }

    console.log('📋 Current calls table columns:');
    data.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    console.log(`\n📊 Total columns: ${data.length}`);

    // Check for key fields that the new system needs
    const requiredFields = [
      'call_summary', 'success_evaluation', 'structured_data', 'call_outcome',
      'outcome_confidence', 'outcome_reasoning', 'outcome_key_points', 'outcome_sentiment',
      'follow_up_required', 'follow_up_notes', 'participant_identity', 'room_name',
      'assistant_config', 'transcription', 'call_sid', 'recording_sid', 'recording_url'
    ];

    const existingFields = data.map(col => col.column_name);
    const missingFields = requiredFields.filter(field => !existingFields.includes(field));

    if (missingFields.length === 0) {
      console.log('\n✅ All required fields are present! No migration needed.');
    } else {
      console.log('\n⚠️  Missing fields that require migration:');
      missingFields.forEach(field => {
        console.log(`   ❌ ${field}`);
      });
      console.log('\n💡 You need to run the migration: backend/database/enhance-calls-table-comprehensive.sql');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCallsTableStructure();

// check-transcription-field.js
// Script to check if transcription field exists and add it if needed

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please check your .env file for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTranscriptionField() {
  try {
    console.log('🔄 Checking if transcription field exists in calls table...');

    // Try to insert a test record with transcription to see if the field exists
    const testData = {
      agent_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      contact_name: 'Test',
      contact_phone: '+1234567890',
      status: 'test',
      transcription: [
        { role: 'user', content: 'test message' },
        { role: 'assistant', content: 'test response' }
      ]
    };

    const { data, error } = await supabase
      .from('calls')
      .insert(testData)
      .select();

    if (error) {
      if (error.message.includes('transcription') || error.message.includes('column') || error.message.includes('does not exist')) {
        console.log('❌ Transcription field does not exist in calls table');
        console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
        console.log('\n' + '='.repeat(60));
        console.log(`
-- Add transcription field to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription JSONB;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calls_transcription ON calls USING GIN (transcription);

-- Add comments for documentation
COMMENT ON COLUMN calls.transcription IS 'JSON array of conversation transcription with role and content fields';
        `);
        console.log('='.repeat(60));
        return;
      } else {
        console.error('❌ Error testing transcription field:', error);
        return;
      }
    }

    console.log('✅ Transcription field exists in calls table');
    console.log('📊 Test data inserted successfully:', data);

    // Clean up test data
    if (data && data.length > 0) {
      await supabase
        .from('calls')
        .delete()
        .eq('id', data[0].id);
      console.log('🧹 Test data cleaned up');
    }

  } catch (error) {
    console.error('❌ Error checking transcription field:', error);
  }
}

// Run the script
checkTranscriptionField();


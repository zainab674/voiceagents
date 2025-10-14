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

async function fixAssistantPhoneAssignment() {
  try {
    console.log('🔧 Fixing assistant phone number assignment...');
    
    const phoneNumber = '+12017656193';
    const assistantId = '1389f36f-b736-42a9-8b6f-a374e66bf86a';
    
    console.log(`📞 Phone number: ${phoneNumber}`);
    console.log(`🤖 Assistant ID: ${assistantId}`);
    
    // Update the phone number to assign it to the correct assistant
    const { data, error } = await supabase
      .from('phone_number')
      .update({ 
        inbound_assistant_id: assistantId,
        updated_at: new Date().toISOString()
      })
      .eq('number', phoneNumber)
      .select();
    
    if (error) {
      console.error('❌ Error updating phone number assignment:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Successfully updated phone number assignment!');
      console.log('📋 Updated record:', data[0]);
      
      // Verify the update
      const { data: verifyData, error: verifyError } = await supabase
        .from('phone_number')
        .select('*')
        .eq('number', phoneNumber)
        .single();
      
      if (verifyError) {
        console.error('❌ Error verifying update:', verifyError.message);
      } else {
        console.log('✅ Verification successful!');
        console.log(`📞 Phone ${phoneNumber} is now assigned to assistant ${verifyData.inbound_assistant_id}`);
      }
    } else {
      console.log('⚠️ No records were updated');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

fixAssistantPhoneAssignment();

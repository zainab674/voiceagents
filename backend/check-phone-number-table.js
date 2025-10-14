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

async function checkPhoneNumberTable() {
  try {
    console.log('Checking phone_number table...');

    // Test if the table exists by trying to query it
    const { data: phoneNumbers, error: testError } = await supabase
      .from('phone_number')
      .select('*')
      .limit(1);

    if (testError) {
      if (testError.code === 'PGRST116') {
        console.log('❌ Phone number table does not exist yet.');
        console.log('\n📋 To create the phone_number table, run this SQL in your Supabase SQL editor:');
        console.log('\n' + '='.repeat(80));
        console.log(`
-- Create phone_number table for voiceagents project
CREATE TABLE IF NOT EXISTS phone_number (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_sid TEXT NOT NULL UNIQUE,
    number TEXT NOT NULL UNIQUE,
    label TEXT,
    inbound_assistant_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    webhook_status TEXT DEFAULT 'configured',
    status TEXT DEFAULT 'active',
    trunk_sid TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_number_user_id ON phone_number(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_number ON phone_number(number);
CREATE INDEX IF NOT EXISTS idx_phone_number_phone_sid ON phone_number(phone_sid);
CREATE INDEX IF NOT EXISTS idx_phone_number_trunk_sid ON phone_number(trunk_sid);
CREATE INDEX IF NOT EXISTS idx_phone_number_assistant_id ON phone_number(inbound_assistant_id);

-- Enable RLS
ALTER TABLE phone_number ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own phone numbers" ON phone_number
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone numbers" ON phone_number
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone numbers" ON phone_number
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phone numbers" ON phone_number
    FOR DELETE USING (auth.uid() = user_id);
        `);
        console.log('='.repeat(80));
        console.log('\n💡 After creating the table, you can add phone numbers through your admin panel.');
        console.log('🔧 The phone number should be in format: +12017656193 (without the _ prefix)');
      } else {
        console.error('❌ Error checking phone_number table:', testError.message);
      }
    } else {
      console.log(`✅ Phone number table exists and is accessible (${phoneNumbers?.length || 0} records)`);
      
      // Check if the specific phone number exists
      const { data: specificPhone, error: specificError } = await supabase
        .from('phone_number')
        .select('*')
        .eq('number', '+12017656193')
        .limit(1);
      
      if (specificError) {
        console.error('❌ Error checking for specific phone number:', specificError.message);
      } else if (specificPhone && specificPhone.length > 0) {
        console.log('✅ Phone number +12017656193 found in database');
        console.log('📋 Phone number details:', specificPhone[0]);
      } else {
        console.log('⚠️  Phone number +12017656193 not found in database');
        console.log('💡 You need to add this phone number to the phone_number table with the correct assistant_id');
      }
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

checkPhoneNumberTable();

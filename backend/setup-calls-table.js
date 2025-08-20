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

async function setupCallsTable() {
  try {
    console.log('Setting up calls table...');
    console.log('Note: This script will create the table structure and insert sample data.');
    console.log('Make sure you have already created the agents table first.');

    // Check if agents table exists and has data
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, user_id')
      .limit(1);

    if (agentsError) {
      console.error('❌ Error accessing agents table:', agentsError.message);
      console.log('Please make sure the agents table exists and you have proper permissions.');
      return;
    }

    if (!agents || agents.length === 0) {
      console.log('⚠️  No agents found. Please create an agent first using the setup-agents-table.js script.');
      return;
    }

    console.log(`✅ Found ${agents.length} agent(s)`);
    const sampleAgent = agents[0];

    // Try to create the calls table by inserting a test record
    // If the table doesn't exist, this will fail and we'll provide instructions
    console.log('Testing calls table access...');
    
    const testCall = {
      agent_id: sampleAgent.id,
      user_id: sampleAgent.user_id,
      contact_name: 'Test Contact',
      contact_phone: '+1234567890',
      status: 'completed',
      duration_seconds: 60,
      outcome: 'test',
      success: true,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString()
    };

    const { error: testError } = await supabase
      .from('calls')
      .insert(testCall);

    if (testError) {
      if (testError.code === '42P01') {
        console.log('❌ Calls table does not exist.');
        console.log('\n📋 To create the calls table, please run the following SQL in your Supabase SQL Editor:');
        console.log('\n' + '='.repeat(60));
        console.log(`
-- Create calls table for analytics
CREATE TABLE IF NOT EXISTS calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(20),
  status VARCHAR(50) NOT NULL DEFAULT 'initiated',
  duration_seconds INTEGER DEFAULT 0,
  outcome VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN DEFAULT false
);

-- Create indexes for calls table
CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_success ON calls(success);

-- Create function to update call duration
CREATE OR REPLACE FUNCTION update_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for call duration
CREATE TRIGGER update_call_duration_trigger
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_call_duration();

-- Enable RLS on calls table
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Create policies for calls table
CREATE POLICY "Users can view own calls" ON calls
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calls" ON calls
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calls" ON calls
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calls" ON calls
  FOR DELETE USING (auth.uid() = user_id);
        `);
        console.log('='.repeat(60));
        console.log('\nAfter running the SQL above, run this script again to insert sample data.');
        return;
      } else {
        console.error('❌ Error testing calls table:', testError.message);
        return;
      }
    }

    // Remove the test record
    await supabase
      .from('calls')
      .delete()
      .eq('outcome', 'test');

    console.log('✅ Calls table exists and is accessible!');

    console.log('✅ Calls table created successfully!');

    // Insert some sample data for testing
    console.log('Inserting sample call data...');
    
    // Get a sample agent to associate with calls
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, user_id')
      .limit(1);

    if (agentsError || !agents.length) {
      console.log('No agents found. Please create an agent first.');
      return;
    }

    const sampleAgent = agents[0];
    
    // Insert sample calls
    const sampleCalls = [
      {
        agent_id: sampleAgent.id,
        user_id: sampleAgent.user_id,
        contact_name: 'John Smith',
        contact_phone: '+1234567890',
        status: 'completed',
        duration_seconds: 245,
        outcome: 'booked',
        success: true,
        started_at: new Date(Date.now() - 3600000).toISOString(),
        ended_at: new Date(Date.now() - 3355000).toISOString()
      },
      {
        agent_id: sampleAgent.id,
        user_id: sampleAgent.user_id,
        contact_name: 'Sarah Johnson',
        contact_phone: '+1234567891',
        status: 'completed',
        duration_seconds: 180,
        outcome: 'follow-up',
        success: true,
        started_at: new Date(Date.now() - 7200000).toISOString(),
        ended_at: new Date(Date.now() - 7020000).toISOString()
      },
      {
        agent_id: sampleAgent.id,
        user_id: sampleAgent.user_id,
        contact_name: 'Mike Davis',
        contact_phone: '+1234567892',
        status: 'failed',
        duration_seconds: 45,
        outcome: 'no-answer',
        success: false,
        started_at: new Date(Date.now() - 10800000).toISOString(),
        ended_at: new Date(Date.now() - 10755000).toISOString()
      }
    ];

    const { error: insertError } = await supabase
      .from('calls')
      .insert(sampleCalls);

    if (insertError) {
      console.error('Error inserting sample calls:', insertError);
    } else {
      console.log('✅ Sample call data inserted successfully!');
    }

    console.log('🎉 Calls table setup completed!');
    console.log('You can now view real-time analytics in your dashboard.');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupCallsTable();

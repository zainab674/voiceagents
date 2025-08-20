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

async function setupAgentsTable() {
  try {
    console.log('Setting up agents table...');

    // Create agents table
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create agents table
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for agents table
        CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
        CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);

        -- Create trigger for updated_at on agents table
        CREATE OR REPLACE FUNCTION update_agents_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        CREATE TRIGGER update_agents_updated_at 
          BEFORE UPDATE ON agents 
          FOR EACH ROW 
          EXECUTE FUNCTION update_agents_updated_at();

        -- Enable Row Level Security (RLS) for agents
        ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

        -- Create policies for agents RLS
        -- Users can only see their own agents
        DROP POLICY IF EXISTS "Users can view own agents" ON agents;
        CREATE POLICY "Users can view own agents" ON agents
          FOR SELECT USING (auth.uid() = user_id);

        -- Users can insert their own agents
        DROP POLICY IF EXISTS "Users can insert own agents" ON agents;
        CREATE POLICY "Users can insert own agents" ON agents
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        -- Users can update their own agents
        DROP POLICY IF EXISTS "Users can update own agents" ON agents;
        CREATE POLICY "Users can update own agents" ON agents
          FOR UPDATE USING (auth.uid() = user_id);

        -- Users can delete their own agents
        DROP POLICY IF EXISTS "Users can delete own agents" ON agents;
        CREATE POLICY "Users can delete own agents" ON agents
          FOR DELETE USING (auth.uid() = user_id);
      `
    });

    if (createError) {
      console.error('Error creating agents table:', createError);
      return;
    }

    console.log('✅ Agents table setup completed successfully!');
    console.log('The table includes:');
    console.log('- id (UUID, Primary Key)');
    console.log('- name (VARCHAR)');
    console.log('- description (TEXT)');
    console.log('- user_id (UUID, Foreign Key to users)');
    console.log('- created_at (Timestamp)');
    console.log('- updated_at (Timestamp)');
    console.log('- Row Level Security (RLS) enabled');
    console.log('- Proper indexes and triggers');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupAgentsTable();

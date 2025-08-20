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

-- Insert sample data for testing (optional)
-- Uncomment the lines below if you want to insert sample data

/*
INSERT INTO calls (agent_id, user_id, contact_name, contact_phone, status, duration_seconds, outcome, success, started_at, ended_at) VALUES
(
  (SELECT id FROM agents LIMIT 1),
  (SELECT user_id FROM agents LIMIT 1),
  'John Smith',
  '+1234567890',
  'completed',
  245,
  'booked',
  true,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour' + INTERVAL '4 minutes 5 seconds'
),
(
  (SELECT id FROM agents LIMIT 1),
  (SELECT user_id FROM agents LIMIT 1),
  'Sarah Johnson',
  '+1234567891',
  'completed',
  180,
  'follow-up',
  true,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours' + INTERVAL '3 minutes'
),
(
  (SELECT id FROM agents LIMIT 1),
  (SELECT user_id FROM agents LIMIT 1),
  'Mike Davis',
  '+1234567892',
  'failed',
  45,
  'no-answer',
  false,
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours' + INTERVAL '45 seconds'
);
*/

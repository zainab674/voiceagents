
CREATE TABLE IF NOT EXISTS user_smtp_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INTEGER,
  username TEXT,
  password TEXT,
  from_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_smtp_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credentials"
ON user_smtp_credentials FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
ON user_smtp_credentials FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
ON user_smtp_credentials FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
ON user_smtp_credentials FOR DELETE
USING (auth.uid() = user_id);

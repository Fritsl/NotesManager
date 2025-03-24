-- Create the profiles table to store user profile information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  payoff TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comment on table
COMMENT ON TABLE profiles IS 'User profile information including payoff data';

-- Add comment on column
COMMENT ON COLUMN profiles.payoff IS 'The user''s profile payoff text';

-- Create an index on user_id
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles (user_id);
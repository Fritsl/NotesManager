-- Add color column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS color INTEGER DEFAULT 0;

-- Update existing notes to have color=0 (transparent) by default
UPDATE notes SET color = 0 WHERE color IS NULL;

-- Add color to the RLS policy for notes
-- This ensures the color column is accessible through the RLS policies
ALTER POLICY "Enable read access for all users" ON notes USING (
  (auth.uid() = user_id) AND (deleted = false OR deleted IS NULL)
) WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Enable insert for users based on user_id" ON notes 
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Enable update for users based on user_id" ON notes 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- You may need to create a new RLS policy if you want to restrict access
-- to the color column differently than other note fields
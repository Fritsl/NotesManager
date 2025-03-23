import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupDatabase() {
  console.log('Setting up database...');
  
  try {
    // Check if projects table exists
    const { error: checkError } = await supabase
      .from('projects')
      .select('id')
      .limit(1);
    
    // If the table already exists, we don't need to create it
    if (!checkError) {
      console.log('Projects table already exists');
      return;
    }
    
    // Create projects table if it doesn't exist
    const { error: createError } = await supabase.rpc('create_projects_table');

    if (createError) {
      // The RPC function doesn't exist, so we'll use raw SQL
      const { error: sqlError } = await supabase.rpc(
        'exec',
        {
          sql: `
            -- Create projects table
            CREATE TABLE IF NOT EXISTS public.projects (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              name TEXT NOT NULL,
              user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              data JSONB NOT NULL
            );

            -- Set up Row Level Security (RLS) so users can only access their own data
            ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

            -- Create policy for users to select only their own projects
            CREATE POLICY "Users can view their own projects" 
              ON public.projects 
              FOR SELECT 
              USING (auth.uid() = user_id);

            -- Create policy for users to insert their own projects
            CREATE POLICY "Users can create their own projects" 
              ON public.projects 
              FOR INSERT 
              WITH CHECK (auth.uid() = user_id);

            -- Create policy for users to update their own projects
            CREATE POLICY "Users can update their own projects" 
              ON public.projects 
              FOR UPDATE 
              USING (auth.uid() = user_id);

            -- Create policy for users to delete their own projects
            CREATE POLICY "Users can delete their own projects" 
              ON public.projects 
              FOR DELETE 
              USING (auth.uid() = user_id);
          `
        }
      );

      if (sqlError) {
        // If the exec function also doesn't exist, we need more permissions
        console.error('Failed to create projects table using RPC:', sqlError);
        console.log('Please run the SQL script manually in the Supabase dashboard.');
        
        // Output the SQL to run manually
        console.log(`
          -- Create projects table
          CREATE TABLE IF NOT EXISTS public.projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            name TEXT NOT NULL,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            data JSONB NOT NULL
          );

          -- Set up Row Level Security (RLS) so users can only access their own data
          ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

          -- Create policy for users to select only their own projects
          CREATE POLICY "Users can view their own projects" 
            ON public.projects 
            FOR SELECT 
            USING (auth.uid() = user_id);

          -- Create policy for users to insert their own projects
          CREATE POLICY "Users can create their own projects" 
            ON public.projects 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);

          -- Create policy for users to update their own projects
          CREATE POLICY "Users can update their own projects" 
            ON public.projects 
            FOR UPDATE 
            USING (auth.uid() = user_id);

          -- Create policy for users to delete their own projects
          CREATE POLICY "Users can delete their own projects" 
            ON public.projects 
            FOR DELETE 
            USING (auth.uid() = user_id);
        `);
        return;
      }
    }
    
    console.log('Projects table created successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
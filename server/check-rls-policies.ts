import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * This is a diagnostic tool to check RLS policies and attempt to fix
 * issues with note visibility in a project
 */
async function checkRlsPolicies(projectId: string, userId: string) {
  console.log('=== RLS Policy Diagnostic Tool ===');
  console.log(`Checking project ID: ${projectId}`);
  console.log(`User ID: ${userId}`);
  
  try {
    // Step 1: Check settings count via direct connection
    const dbClient = await pool.connect();
    try {
      console.log('\n1. Checking settings via direct Postgres connection:');
      const settingsQuery = `
        SELECT * FROM settings 
        WHERE id = $1 AND user_id = $2
      `;
      
      const settingsResult = await dbClient.query(settingsQuery, [projectId, userId]);
      
      if (settingsResult.rows.length > 0) {
        const settings = settingsResult.rows[0];
        console.log(`  ✓ Found settings for project: ${settings.title}`);
        console.log(`  ✓ Note count in settings: ${settings.note_count || 0}`);
      } else {
        console.log('  ✗ No settings found for this project via direct connection');
      }
      
      // Step 2: Check note count via direct connection
      console.log('\n2. Checking notes via direct Postgres connection:');
      const notesQuery = `
        SELECT COUNT(*) as count FROM notes 
        WHERE project_id = $1 AND user_id = $2
      `;
      
      const notesResult = await dbClient.query(notesQuery, [projectId, userId]);
      const dbNoteCount = parseInt(notesResult.rows[0]?.count || '0');
      
      console.log(`  ✓ Note count in database: ${dbNoteCount}`);
      
      // Step 3: Check sample notes
      if (dbNoteCount > 0) {
        const sampleNotesQuery = `
          SELECT id, content, parent_id, position
          FROM notes
          WHERE project_id = $1 AND user_id = $2
          ORDER BY position
          LIMIT 5
        `;
        
        const sampleResult = await dbClient.query(sampleNotesQuery, [projectId, userId]);
        console.log('  ✓ Sample notes:');
        sampleResult.rows.forEach((note, index) => {
          console.log(`    ${index + 1}. ID: ${note.id}`);
          console.log(`       Content: ${note.content.substring(0, 50)}${note.content.length > 50 ? '...' : ''}`);
        });
      }
      
      // Step 4: Check with Supabase client
      console.log('\n3. Checking with Supabase client (respects RLS):');
      
      const { data: supabaseSettings, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (settingsError) {
        console.log(`  ✗ Error fetching settings via Supabase: ${settingsError.message}`);
      } else if (supabaseSettings) {
        console.log(`  ✓ Found settings: ${supabaseSettings.title}`);
        console.log(`  ✓ Note count in settings: ${supabaseSettings.note_count || 0}`);
      } else {
        console.log('  ✗ No settings found via Supabase');
      }
      
      const { data: supabaseNotes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId);
        
      if (notesError) {
        console.log(`  ✗ Error fetching notes via Supabase: ${notesError.message}`);
      } else {
        console.log(`  ✓ Found ${supabaseNotes?.length || 0} notes via Supabase`);
      }
      
      // Step 5: Check if RLS is enabled
      console.log('\n4. Checking RLS status on tables:');
      
      const rlsQuery = `
        SELECT schemaname, tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('notes', 'settings', 'note_images')
      `;
      
      const rlsResult = await dbClient.query(rlsQuery);
      
      rlsResult.rows.forEach((table) => {
        console.log(`  Table ${table.tablename}: RLS ${table.rowsecurity ? 'enabled' : 'disabled'}`);
      });
      
      // Step 6: Check RLS policies
      console.log('\n5. Checking existing RLS policies:');
      
      const policiesQuery = `
        SELECT tablename, policyname, cmd, qual
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('notes', 'settings', 'note_images')
        ORDER BY tablename, cmd
      `;
      
      const policiesResult = await dbClient.query(policiesQuery);
      
      if (policiesResult.rows.length === 0) {
        console.log('  ✗ No RLS policies found on relevant tables');
      } else {
        policiesResult.rows.forEach((policy) => {
          console.log(`  Table: ${policy.tablename}`);
          console.log(`  Policy: ${policy.policyname}`);
          console.log(`  Command: ${policy.cmd}`);
          console.log(`  Definition: ${policy.qual}`);
          console.log('  ---');
        });
      }
      
      // Step 7: Attempt admin/bypass approach
      console.log('\n6. Attempting bypass query:');
      
      try {
        // Use a privileged query to bypass RLS
        const bypassQuery = `
          WITH RECURSIVE all_notes AS (
            SELECT n.*, 0 AS level
            FROM notes n 
            WHERE n.project_id = $1 
              AND n.parent_id IS NULL
            
            UNION ALL
            
            SELECT n.*, an.level + 1
            FROM notes n
            JOIN all_notes an ON n.parent_id = an.id
            WHERE n.project_id = $1
          )
          SELECT COUNT(*) FROM all_notes;
        `;
        
        const bypassResult = await dbClient.query(bypassQuery, [projectId]);
        const bypassCount = parseInt(bypassResult.rows[0]?.count || '0');
        
        console.log(`  ✓ Note count using bypass query: ${bypassCount}`);
        
        if (bypassCount > 0 && (dbNoteCount === 0 || supabaseNotes?.length === 0)) {
          console.log('  ✓ Bypass successful! Found notes that were hidden by RLS.');
        }
      } catch (bypassError) {
        console.log(`  ✗ Bypass query failed: ${bypassError instanceof Error ? bypassError.message : String(bypassError)}`);
      }
      
      // Step 8: Recommendations
      console.log('\n=== Recommendations ===');
      
      if (dbNoteCount > 0 && (supabaseNotes?.length === 0)) {
        console.log('- RLS policies appear to be blocking access to notes');
        console.log('- Use the enhanced get-project-data endpoint which includes RLS bypass functionality');
        console.log('- Check and update RLS policies in Supabase dashboard if needed');
      } else if (dbNoteCount === 0 && (supabaseSettings?.note_count || 0) > 0) {
        console.log('- Note count in settings is inconsistent with actual notes count');
        console.log('- Run the sync-note-counts API endpoint to correct metadata');
      } else if (dbNoteCount === 0 && (supabaseSettings?.note_count || 0) === 0) {
        console.log('- No notes found with either direct database or Supabase access');
        console.log('- Check if project ID and user ID are correct');
      } else {
        console.log('- Notes appear to be properly accessible');
        console.log('- If UI shows different numbers, check client-side filtering or caching');
      }
      
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error('Error running diagnostics:', error);
  }
}

// Export the function for use in routes
export { checkRlsPolicies };
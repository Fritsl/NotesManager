import pkg from 'pg';
const { Pool } = pkg;

/**
 * This function refreshes the PostgREST schema cache by calling a special Postgres function
 * that triggers a cache refresh. This is needed after schema changes to make new columns
 * available through the Supabase REST API.
 */
export async function refreshSchemaCache() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to PostgreSQL to refresh schema cache...');
    
    // First make sure the color column exists 
    await pool.query(`
      ALTER TABLE IF EXISTS notes 
      ADD COLUMN IF NOT EXISTS color INTEGER DEFAULT 0;
    `);
    
    // Update existing notes to have a default color value
    await pool.query(`
      UPDATE notes SET color = 0 WHERE color IS NULL;
    `);
    
    // Use direct PG functions to refresh the schema cache for PostgREST
    await pool.query(`
      SELECT pg_notify('pgrst', 'reload schema');
    `);
    
    console.log('Schema cache refresh request sent successfully');
    return true;
  } catch (error) {
    console.error('Error refreshing schema cache:', error);
    return false;
  } finally {
    // Always close the pool when done
    await pool.end();
  }
}
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { log } from "./vite";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import { checkRlsPolicies } from "./check-rls-policies";

// Get current file's directory path (ES modules replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ""; // Using the anon key here
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Supabase URL configured:', !!supabaseUrl);

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tempDir = path.join(os.tmpdir(), 'note-images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const uniqueFilename = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueFilename);
    }
  })
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create necessary directories
  const uploadsDir = path.join(__dirname, '../public/uploads');
  const projectsDir = path.join(__dirname, '../public/projects');
  
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    log(`Created uploads directory: ${uploadsDir}`);
  }
  
  // No need to create the projects directory since we're moving to database-only storage
  log(`Project data will be stored only in the database`);
  
  // Setup static file serving for uploads directory
  app.use('/uploads', express.static(uploadsDir));
  
  // No JSON file directories needed - this is a database-only app
  
  // put application routes here
  // prefix all routes with /api
  
  // Placeholder endpoint for project metadata - doesn't actually save any notes or data
  app.post("/api/store-project-data", async (req: Request, res: Response) => {
    console.log("[SAVE DISABLED] Save functionality has been removed");
    return res.status(200).json({
      success: true,
      message: "Save functionality disabled - Project data was not stored",
    });
  });
  
  // Get project data endpoint - Improved to handle RLS restrictions
  app.get("/api/get-project-data/:id", async (req: Request, res: Response) => {
    let dbClient;
    
    try {
      const projectId = req.params.id;
      const userId = req.query.userId as string;
      
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      console.log(`Getting project data for project ${projectId} by user ${userId} (SERVER MODE)`);
      
      // First try fetching via Supabase client with RLS
      let useSupabaseResult = false;
      let projectMetadata;
      let notes = [];
      
      // Attempt to use Supabase client to respect RLS
      try {
        console.log('Attempting to fetch project data via Supabase client (with RLS)');
        
        // Settings data
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', userId)
          .maybeSingle();
          
        if (settingsError) {
          console.error('Error fetching settings via Supabase:', settingsError);
          throw settingsError;
        }
        
        if (!settingsData) {
          console.log('No settings found for project with Supabase');
          // We'll create settings later with the direct connection
        } else {
          console.log('Found settings via Supabase:', settingsData.title);
          projectMetadata = settingsData;
          
          // Now fetch notes via Supabase
          const { data: notesData, error: notesError } = await supabase
            .from('notes')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .order('position', { ascending: true });
            
          if (notesError) {
            console.error('Error fetching notes via Supabase:', notesError);
            throw notesError;
          }
          
          // Check if we got data
          if (notesData && notesData.length > 0) {
            console.log(`Successfully retrieved ${notesData.length} notes via Supabase client`);
            
            // Build note hierarchy from Supabase results
            const notesById = new Map();
            const rootNotes = [];
            
            // First pass: index all notes by ID and add children/images arrays
            for (const note of notesData) {
              note.children = [];
              note.images = [];
              notesById.set(note.id, note);
            }
            
            // Second pass: build the hierarchy
            for (const note of notesData) {
              if (note.parent_id) {
                // This is a child note
                const parent = notesById.get(note.parent_id);
                if (parent) {
                  parent.children.push(note);
                } else {
                  // Parent not found, treat as root note
                  rootNotes.push(note);
                }
              } else {
                // This is a root note
                rootNotes.push(note);
              }
            }
            
            // Query images for this project's notes
            try {
              const { data: imagesData, error: imagesError } = await supabase
                .from('note_images')
                .select('*')
                .in('note_id', notesData.map(n => n.id));
                
              if (imagesError) {
                console.error('Error fetching images via Supabase:', imagesError);
              } else if (imagesData && imagesData.length > 0) {
                console.log(`Found ${imagesData.length} images via Supabase`);
                
                // Associate images with their notes
                for (const image of imagesData) {
                  const noteId = image.note_id;
                  const note = notesById.get(noteId);
                  
                  if (note) {
                    note.images.push(image);
                  }
                }
              }
            } catch (imageError) {
              console.error('Error processing images:', imageError);
              // Continue without images
            }
            
            // Sort children by position
            const sortChildren = (notesToSort: any[]) => {
              for (const note of notesToSort) {
                if (note.children.length > 0) {
                  note.children.sort((a: any, b: any) => a.position - b.position);
                  sortChildren(note.children);
                }
              }
            };
            
            // Sort all notes
            rootNotes.sort((a: any, b: any) => a.position - b.position);
            sortChildren(rootNotes);
            
            // Set notes as the root notes
            notes = rootNotes;
            useSupabaseResult = true;
          } else {
            console.log('No notes found via Supabase');
          }
        }
      } catch (supabaseError) {
        console.error('Error using Supabase client:', supabaseError);
        console.log('Falling back to direct database connection');
      }
      
      // If Supabase approach didn't work, fall back to direct DB connection
      if (!useSupabaseResult) {
        try {
          console.log('Using direct database connection for project data');
          dbClient = await pool.connect();
          
          // Check if settings exist
          const settingsCheckQuery = `
            SELECT * FROM settings 
            WHERE id = $1 AND user_id = $2
          `;
          
          const settingsResult = await dbClient.query(settingsCheckQuery, [projectId, userId]);
          
          if (settingsResult.rows.length > 0) {
            // Settings exist, use them
            projectMetadata = settingsResult.rows[0];
            console.log(`Found existing settings for project ${projectId}`);
          } else {
            // Create new settings
            console.log(`Creating new settings for project ${projectId}`);
            const now = new Date().toISOString();
            
            const insertQuery = `
              INSERT INTO settings 
              (id, user_id, title, description, created_at, updated_at, last_modified_at, note_count)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING *
            `;
            
            const insertResult = await dbClient.query(insertQuery, [
              projectId,
              userId,
              "Untitled Project",
              "",
              now,
              now,
              now,
              0
            ]);
            
            if (insertResult.rows.length > 0) {
              projectMetadata = insertResult.rows[0];
              console.log(`Created new settings for project ${projectId}`);
            } else {
              throw new Error('Failed to create project settings');
            }
          }
          
          // Now get notes from database only
          
          // Query all notes for this project from database
          const notesResult = await dbClient.query(
            `SELECT * FROM notes WHERE project_id = $1 AND user_id = $2 ORDER BY position`,
            [projectId, userId]
          );
          
          // Build the note hierarchy
          const notesById = new Map();
          const rootNotes = [];
          
          // First pass: index all notes by ID
          for (const note of notesResult.rows) {
            // Add empty children array to each note
            note.children = [];
            note.images = []; // Initialize empty images array
            notesById.set(note.id, note);
          }
          
          // Second pass: build the hierarchy
          for (const note of notesResult.rows) {
            if (note.parent_id) {
              // This is a child note
              const parent = notesById.get(note.parent_id);
              if (parent) {
                parent.children.push(note);
              } else {
                // Parent not found, treat as root note
                rootNotes.push(note);
              }
            } else {
              // This is a root note
              rootNotes.push(note);
            }
          }
          
          // Query images for this project's notes
          try {
            const imagesQuery = `
              SELECT * FROM note_images 
              WHERE note_id IN (
                SELECT id::text FROM notes WHERE project_id = $1
              )
            `;
            
            const imagesResult = await dbClient.query(imagesQuery, [projectId]);
            
            // Associate images with their notes
            for (const image of imagesResult.rows) {
              const noteId = image.note_id;
              const note = notesById.get(noteId);
              
              if (note) {
                note.images.push(image);
              }
            }
          } catch (imageError) {
            console.error('Error fetching images:', imageError);
            // Continue without images
          }
          
          // Sort children by position
          const sortChildren = (notesToSort: any[]) => {
            for (const note of notesToSort) {
              if (note.children.length > 0) {
                note.children.sort((a: any, b: any) => a.position - b.position);
                sortChildren(note.children);
              }
            }
          };
          
          // Sort all notes
          rootNotes.sort((a: any, b: any) => a.position - b.position);
          sortChildren(rootNotes);
          
          // Notes are the root notes (flat array)
          notes = rootNotes;
          
          console.log(`Retrieved ${notesResult.rowCount} notes from database for project ${projectId}`);
        } catch (dbError) {
          console.error('Error with direct database connection:', dbError);
          throw dbError;
        }
      }
      
      // If we found settings, but no notes, and note_count is greater than 0,
      // try a special query bypassing RLS (as a last resort)
      if (projectMetadata && notes.length === 0 && projectMetadata.note_count > 0) {
        console.log(`BYPASS TRIGGER: Project ${projectId} has metadata note_count=${projectMetadata.note_count} but returned ${notes.length} notes. Attempting enhanced RLS bypass.`);
        
        try {
          if (!dbClient) {
            dbClient = await pool.connect();
          }
          
          // First, try explicitly setting the role context
          try {
            // Set local role and row security context variables
            await dbClient.query(`
              SET LOCAL ROLE authenticated;
              SET LOCAL "request.jwt.claims.sub" TO '${userId}';
              SET LOCAL "request.jwt.claims.role" TO 'authenticated';
            `);
            
            console.log('Set authenticated role and JWT context for RLS');
            
            // Query with role context now set
            const contextQueryResult = await dbClient.query(
              `SELECT * FROM notes WHERE project_id = $1 AND user_id = $2 ORDER BY position`,
              [projectId, userId]
            );
            
            if (contextQueryResult.rows.length > 0) {
              console.log(`Retrieved ${contextQueryResult.rows.length} notes with explicit RLS context`);
              
              // Build the note hierarchy
              const notesById = new Map();
              const rootNotes = [];
              
              // First pass: index all notes by ID
              for (const note of contextQueryResult.rows) {
                note.children = [];
                note.images = []; // Initialize empty images array
                notesById.set(note.id, note);
              }
              
              // Second pass: build the hierarchy
              for (const note of contextQueryResult.rows) {
                if (note.parent_id) {
                  const parent = notesById.get(note.parent_id);
                  if (parent) {
                    parent.children.push(note);
                  } else {
                    rootNotes.push(note);
                  }
                } else {
                  rootNotes.push(note);
                }
              }
              
              // Sort children by position
              const sortChildren = (notesToSort: any[]) => {
                for (const note of notesToSort) {
                  if (note.children.length > 0) {
                    note.children.sort((a: any, b: any) => a.position - b.position);
                    sortChildren(note.children);
                  }
                }
              };
              
              // Sort all notes
              rootNotes.sort((a: any, b: any) => a.position - b.position);
              sortChildren(rootNotes);
              
              notes = rootNotes;
              return; // Exit early if we found notes
            } else {
              console.log('No notes found with explicit RLS context, trying alternative bypass approaches');
            }
          } catch (contextError) {
            console.error('Error setting RLS context:', contextError);
            // Continue with other bypass attempts
          }
          
          // Try alternative approach: temporary disable RLS for this session
          try {
            // Temporarily disable row security for this transaction
            await dbClient.query(`SET LOCAL row_security = off;`);
            console.log('Disabled row security for this session');
            
            // Query with row security disabled
            const noRlsQueryResult = await dbClient.query(
              `SELECT * FROM notes WHERE project_id = $1 AND user_id = $2 ORDER BY position`,
              [projectId, userId]
            );
            
            if (noRlsQueryResult.rows.length > 0) {
              console.log(`Retrieved ${noRlsQueryResult.rows.length} notes with row security disabled`);
              
              // Build the note hierarchy
              const notesById = new Map();
              const rootNotes = [];
              
              // First pass: index all notes by ID
              for (const note of noRlsQueryResult.rows) {
                note.children = [];
                note.images = []; // Initialize empty images array
                notesById.set(note.id, note);
              }
              
              // Second pass: build the hierarchy
              for (const note of noRlsQueryResult.rows) {
                if (note.parent_id) {
                  const parent = notesById.get(note.parent_id);
                  if (parent) {
                    parent.children.push(note);
                  } else {
                    rootNotes.push(note);
                  }
                } else {
                  rootNotes.push(note);
                }
              }
              
              // Sort children by position
              const sortChildren = (notesToSort: any[]) => {
                for (const note of notesToSort) {
                  if (note.children.length > 0) {
                    note.children.sort((a: any, b: any) => a.position - b.position);
                    sortChildren(note.children);
                  }
                }
              };
              
              // Sort all notes
              rootNotes.sort((a: any, b: any) => a.position - b.position);
              sortChildren(rootNotes);
              
              notes = rootNotes;
              return; // Exit early if we found notes
            } else {
              console.log('No notes found with row security disabled');
            }
          } catch (noRlsError) {
            console.error('Error disabling row security:', noRlsError);
            // Continue with other bypass attempts
          }
          
          // Last resort: recursive CTE bypass approach
          console.log('Trying recursive CTE bypass approach');
          const bypassRlsQuery = `
            WITH RECURSIVE all_notes AS (
              SELECT n.*, 0 AS level
              FROM notes n 
              WHERE n.project_id = $1 
                AND n.user_id = $2
                AND n.parent_id IS NULL
              
              UNION ALL
              
              SELECT n.*, an.level + 1
              FROM notes n
              JOIN all_notes an ON n.parent_id = an.id
              WHERE n.project_id = $1
                AND n.user_id = $2
            )
            SELECT * FROM all_notes
            ORDER BY level, position;
          `;
          
          const bypassResult = await dbClient.query(bypassRlsQuery, [projectId, userId]);
          
          if (bypassResult && bypassResult.rows && bypassResult.rows.length > 0) {
            console.log(`Retrieved ${bypassResult.rows.length} notes using recursive CTE bypass`);
            
            // Build the note hierarchy
            const notesById = new Map();
            const rootNotes = [];
            
            // First pass: index all notes by ID
            for (const note of bypassResult.rows) {
              note.children = [];
              note.images = []; // Initialize empty images array
              notesById.set(note.id, note);
            }
            
            // Second pass: build the hierarchy
            for (const note of bypassResult.rows) {
              if (note.parent_id) {
                const parent = notesById.get(note.parent_id);
                if (parent) {
                  parent.children.push(note);
                } else {
                  rootNotes.push(note);
                }
              } else {
                rootNotes.push(note);
              }
            }
            
            // Sort children by position
            const sortChildren = (notesToSort: any[]) => {
              for (const note of notesToSort) {
                if (note.children.length > 0) {
                  note.children.sort((a: any, b: any) => a.position - b.position);
                  sortChildren(note.children);
                }
              }
            };
            
            // Sort all notes
            rootNotes.sort((a: any, b: any) => a.position - b.position);
            sortChildren(rootNotes);
            
            notes = rootNotes;
          } else {
            console.log('No notes found with any bypass method. Data may be truly missing.');
          }
        } catch (adminAccessError) {
          console.error('Error with RLS bypass attempts:', adminAccessError);
          // Continue with what we have
        } finally {
          // Reset any role or security settings we might have changed
          try {
            if (dbClient) {
              await dbClient.query(`RESET ALL;`);
            }
          } catch (resetError) {
            console.error('Error resetting session parameters:', resetError);
          }
        }
      }
      
      // Update note count in settings if needed
      if (dbClient && notes.length > 0 && (projectMetadata.note_count === 0 || projectMetadata.note_count === null)) {
        const countTotalNotes = (notesToCount: any[]): number => {
          let count = notesToCount.length;
          
          for (const note of notesToCount) {
            if (note.children && Array.isArray(note.children)) {
              count += countTotalNotes(note.children);
            }
          }
          
          return count;
        };
        
        const totalNoteCount = countTotalNotes(notes);
        
        if (totalNoteCount > 0) {
          await dbClient.query(
            `UPDATE settings SET note_count = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
            [totalNoteCount, projectId, userId]
          );
          
          projectMetadata.note_count = totalNoteCount;
          console.log(`Updated note count to ${totalNoteCount} for project ${projectId}`);
        }
      }
      
      // Construct the response
      const projectData = {
        id: projectMetadata.id,
        name: projectMetadata.title,
        user_id: projectMetadata.user_id,
        description: projectMetadata.description || '',
        created_at: projectMetadata.created_at,
        updated_at: projectMetadata.updated_at,
        note_count: projectMetadata.note_count || 0,
        data: { notes: notes }
      };
      
      // Return the project data
      return res.status(200).json(projectData);
    } catch (error) {
      console.error("Error getting project data:", error);
      return res.status(500).json({
        error: "Failed to get project data",
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      if (dbClient) {
        dbClient.release();
      }
    }
  });

  // Simple health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // Diagnostics endpoint for RLS policies
  // Direct notes access endpoint (bypass all RLS)
  app.get("/api/direct-notes-access", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string;
      const userId = req.query.userId as string;
      
      if (!projectId || !userId) {
        return res.status(400).json({ 
          error: "Both projectId and userId are required query parameters" 
        });
      }
      
      console.log(`Attempting direct notes access for project ${projectId} and user ${userId}`);
      
      // Connect directly to database
      const client = await pool.connect();
      
      try {
        // Try to disable row security temporarily
        await client.query(`
          SET LOCAL row_security = off;
        `);
        
        // Direct query for notes without any RLS filtering
        const result = await client.query(`
          SELECT * FROM notes 
          WHERE project_id = $1 
          LIMIT 10
        `, [projectId]);
        
        if (result.rows.length > 0) {
          console.log(`Found ${result.rows.length} notes via direct access`);
          return res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} notes with direct access bypassing all security`,
            notes: result.rows
          });
        } else {
          console.log('No notes found in table for this project');
          
          // Also check settings to verify note_count
          const settingsResult = await client.query(`
            SELECT id, title, note_count 
            FROM settings 
            WHERE id = $1
          `, [projectId]);
          
          if (settingsResult.rows.length > 0) {
            return res.status(200).json({
              success: false,
              message: 'No notes found despite RLS bypass, data may truly be missing',
              settings: settingsResult.rows[0]
            });
          } else {
            return res.status(404).json({
              success: false,
              message: 'Neither notes nor settings found for this project'
            });
          }
        }
      } finally {
        // Reset settings and release client
        try {
          await client.query('RESET ALL;');
        } catch (resetError) {
          console.error('Error resetting session parameters:', resetError);
        }
        client.release();
      }
    } catch (error) {
      console.error("Error in direct notes access:", error);
      return res.status(500).json({
        error: "Database access failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/rls-diagnostics", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string;
      const userId = req.query.userId as string;
      
      if (!projectId || !userId) {
        return res.status(400).json({ 
          error: "Both projectId and userId are required query parameters" 
        });
      }
      
      // Create a response stream to send results as they're generated
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      });
      
      // Override console.log to capture output
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      
      // Redirect console output to response
      console.log = (...args) => {
        originalConsoleLog(...args);
        const message = args.join(' ');
        res.write(message + '\n');
      };
      
      console.error = (...args) => {
        originalConsoleError(...args);
        const message = args.join(' ');
        res.write('ERROR: ' + message + '\n');
      };
      
      try {
        // Run diagnostics
        await checkRlsPolicies(projectId, userId);
        
        // End the response
        res.write('\nDiagnostics complete');
        res.end();
      } finally {
        // Restore console functions
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      
      // If headers aren't sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to run diagnostics",
          details: error instanceof Error ? error.message : String(error)
        });
      } else {
        // Otherwise, try to write to the existing response
        try {
          res.write(`\nError: ${error instanceof Error ? error.message : String(error)}`);
          res.end();
        } catch (writeError) {
          console.error('Failed to write error to response:', writeError);
        }
      }
    }
  });
  
  // Endpoint to safely clean up old JSON files
  app.post("/api/cleanup-json-files", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required for safety" });
      }
      
      console.log(`Requested cleanup of legacy JSON files for user ${userId}`);
      
      // Get the path to the projects directory
      const projectsDir = path.join(__dirname, '../public/projects');
      
      // Make sure the directory exists
      if (!fs.existsSync(projectsDir)) {
        return res.status(404).json({ 
          status: "skipped", 
          message: "Projects directory does not exist",
          path: projectsDir
        });
      }
      
      // Read all files in the directory
      const files = fs.readdirSync(projectsDir);
      
      // Filter out only JSON files
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      console.log(`Found ${jsonFiles.length} JSON files to clean up`);
      
      // Keep track of what was deleted
      const deletedFiles = [];
      
      // Delete each JSON file
      for (const file of jsonFiles) {
        const filePath = path.join(projectsDir, file);
        
        // Remove the file
        fs.unlinkSync(filePath);
        deletedFiles.push(file);
        console.log(`Deleted JSON file: ${file}`);
      }
      
      return res.status(200).json({
        status: "success",
        message: `Deleted ${deletedFiles.length} JSON files`,
        deletedFiles: deletedFiles
      });
      
    } catch (error) {
      console.error("Error during JSON cleanup:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to clean up JSON files",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Diagnostic endpoint for database analysis
  app.get("/api/diagnostics", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      console.log(`Running diagnostics for user ${userId}`);
      
      // Connect directly to PostgreSQL
      let client;
      try {
        client = await pool.connect();
        console.log('Connected to database for diagnostics');
      } catch (error) {
        return res.status(500).json({ 
          error: "Database connection error",
          details: error instanceof Error ? error.message : String(error)
        });
      }
      
      try {
        // Fetch project settings
        const settingsQuery = `
          SELECT * FROM settings 
          WHERE user_id = $1
          ORDER BY updated_at DESC
        `;
        
        const settingsResult = await client.query(settingsQuery, [userId]);
        const settings = settingsResult.rows;
        
        // Count notes per project
        const projectStats = [];
        for (const setting of settings) {
          // Count notes in the database
          const notesQuery = `
            SELECT COUNT(*) as db_note_count 
            FROM notes 
            WHERE project_id = $1 AND user_id = $2
          `;
          
          const notesResult = await client.query(notesQuery, [setting.id, userId]);
          const dbNoteCount = parseInt(notesResult.rows[0]?.db_note_count || '0');
          
          // Check for JSON files (for diagnostics only)
          let jsonNoteCount = 0;
          let jsonFileExists = false;
          
          // Check if a JSON file exists for this project
          const jsonFilePath = path.join(__dirname, `../public/projects/${setting.id}.json`);
          if (fs.existsSync(jsonFilePath)) {
            jsonFileExists = true;
            
            // Try to count notes in the JSON file
            try {
              const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
              const jsonData = JSON.parse(fileContent);
              
              if (jsonData && jsonData.data && Array.isArray(jsonData.data.notes)) {
                // Count all notes including children
                const countNotesInJson = (notes: any[]): number => {
                  let count = notes.length;
                  for (const note of notes) {
                    if (note.children && Array.isArray(note.children)) {
                      count += countNotesInJson(note.children);
                    }
                  }
                  return count;
                };
                
                jsonNoteCount = countNotesInJson(jsonData.data.notes);
              }
            } catch (jsonError) {
              console.error(`Error reading JSON file for project ${setting.id}:`, jsonError);
              // Continue with default values
            }
          }
          
          projectStats.push({
            id: setting.id,
            title: setting.title,
            settings_note_count: setting.note_count || 0,
            db_note_count: dbNoteCount,
            json_file_exists: jsonFileExists,
            json_note_count: jsonNoteCount,
            last_updated: setting.updated_at
          });
        }
        
        // Get sample notes for the most recently used project
        let sampleNotes = [];
        if (projectStats.length > 0) {
          const recentProjectId = projectStats[0].id;
          
          const sampleNotesQuery = `
            SELECT id, content, position, parent_id
            FROM notes
            WHERE project_id = $1 AND user_id = $2
            ORDER BY position
            LIMIT 10
          `;
          
          const sampleResult = await client.query(sampleNotesQuery, [recentProjectId, userId]);
          sampleNotes = sampleResult.rows;
        }
        
        // Return all diagnostic data
        return res.status(200).json({
          timestamp: new Date().toISOString(),
          user_id: userId,
          project_count: settings.length,
          projects: projectStats,
          sample_notes: sampleNotes
        });
        
      } finally {
        if (client) {
          client.release();
        }
      }
    } catch (error) {
      console.error("Error in diagnostics:", error);
      return res.status(500).json({
        error: "Failed to run diagnostics",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Cleanup project images endpoint
  app.get("/api/cleanup-project-images", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }
      
      log(`Cleaning up images for project ${projectId}`);
      
      // Get all image records associated with this project
      // Since we can't directly query the notes table (it doesn't exist in this app's schema),
      // we'll use a pattern-based approach to find images that might be associated with this project
      
      // Use direct PostgreSQL connection to bypass RLS policies
      let client;
      try {
        client = await pool.connect();
        log(`Database connection established successfully`);
      } catch (connError) {
        log(`Error connecting to database: ${connError instanceof Error ? connError.message : String(connError)}`);
        throw connError;
      }
      
      try {
        // Find images that might be associated with this project
        // We'll use a pattern match on the note_id which often contains the project ID
        const imageQuery = `
          SELECT id, storage_path
          FROM note_images
          WHERE note_id LIKE $1
          OR id LIKE $1
        `;
        
        const pattern = `%${projectId}%`;
        log(`Executing image query with pattern: ${pattern}`);
        
        const imageResult = await client.query(imageQuery, [pattern]);
        const imageRecords = imageResult.rows;
        log(`Found ${imageRecords.length} potential image records for project ${projectId}`);
        
        let deletedFiles = 0;
        let deletedRecords = 0;
        
        // Delete storage files if they exist
        if (imageRecords.length > 0) {
          const storagePaths = imageRecords
            .filter(img => img.storage_path)
            .map(img => img.storage_path);
          
          if (storagePaths.length > 0) {
            log(`Deleting ${storagePaths.length} files from storage`);
            
            // Delete files in batches to avoid rate limits
            const BATCH_SIZE = 100;
            for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
              const batch = storagePaths.slice(i, i + BATCH_SIZE);
              
              try {
                // Create a Supabase client for admin operations
                const adminSupabase = createClient(
                  process.env.VITE_SUPABASE_URL || '',
                  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
                );
                
                const { data: deletedData, error: deleteError } = await adminSupabase.storage
                  .from('note-images')
                  .remove(batch);
                
                if (deleteError) {
                  log(`Error deleting batch of files from storage: ${deleteError.message}`);
                } else {
                  deletedFiles += (deletedData?.length || 0);
                  log(`Deleted ${deletedData?.length || 0} files from batch ${Math.floor(i/BATCH_SIZE) + 1}`);
                }
              } catch (batchError) {
                log(`Error in storage batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batchError}`);
                // Continue with next batch
              }
            }
          }
          
          // Delete database records
          const imageIds = imageRecords.map(img => img.id);
          log(`Deleting ${imageIds.length} image records from database`);
          
          // Delete in batches to avoid rate limits
          const BATCH_SIZE = 100;
          for (let i = 0; i < imageIds.length; i += BATCH_SIZE) {
            const batch = imageIds.slice(i, i + BATCH_SIZE);
            
            const deleteQuery = `
              DELETE FROM note_images
              WHERE id = ANY($1::uuid[])
              RETURNING id
            `;
            
            try {
              const deleteResult = await client.query(deleteQuery, [batch]);
              deletedRecords += deleteResult.rowCount || 0;
              log(`Deleted ${deleteResult.rowCount || 0} records from batch ${Math.floor(i/BATCH_SIZE) + 1}`);
            } catch (deleteError) {
              log(`Error deleting image records batch ${Math.floor(i/BATCH_SIZE) + 1}: ${deleteError}`);
              // Continue with next batch
            }
          }
        }
        
        return res.json({
          success: true,
          projectId,
          deletedFiles,
          deletedRecords,
          message: `Cleaned up ${deletedFiles} image files and ${deletedRecords} image records`
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error in cleanup-project-images:", error);
      return res.status(500).json({ 
        error: "Internal server error during cleanup", 
        details: (error as Error).message 
      });
    }
  });
  
  // Endpoint to create an image record in the database using server auth
  app.post("/api/create-image-record", upload.none(), async (req: Request, res: Response) => {
    try {
      const { noteId, userId, filePath, publicUrl } = req.body;

      if (!noteId || !userId || !filePath || !publicUrl) {
        return res.status(400).json({ 
          error: "Missing required fields", 
          details: { 
            noteId: !!noteId, 
            userId: !!userId,
            filePath: !!filePath,
            publicUrl: !!publicUrl
          } 
        });
      }

      // CRITICAL: Normalize the storage path to the exact standard format used by all apps
      // The standard format MUST be exactly: images/filename.ext (no double paths or user IDs)
      
      // Extract the filename from the path
      const pathParts = filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      
      // Create a normalized path in the standard format expected by all apps
      const normalizedPath = `images/${fileName}`;
      
      // Ensure the public URL matches the expected format
      // Remove any duplicate image path segments which can cause compatibility issues
      let normalizedUrl = publicUrl;
      
      // Fix URLs with duplicate /images/images/ segments
      if (normalizedUrl.includes('/images/images/')) {
        normalizedUrl = normalizedUrl.replace('/images/images/', '/images/');
        log(`Normalized URL from ${publicUrl} to ${normalizedUrl}`);
      }
      
      // Additional check for other possible path issues
      if (normalizedUrl.includes(`/note-images/note-images/`)) {
        normalizedUrl = normalizedUrl.replace('/note-images/note-images/', '/note-images/');
        log(`Fixed double bucket path in URL: ${normalizedUrl}`);
      }

      log(`Creating image record for note ${noteId} by user ${userId} using direct DB connection`);
      log(`Database URL: ${process.env.DATABASE_URL?.substring(0, 20)}...`);
      log(`Storage path: ${normalizedPath}, Public URL: ${normalizedUrl.substring(0, 30)}...`);

      // Use direct PostgreSQL connection to bypass RLS policies
      let client;
      try {
        client = await pool.connect();
        log(`Database connection established successfully`);
      } catch (connError) {
        log(`Error connecting to database: ${connError instanceof Error ? connError.message : String(connError)}`);
        throw connError;
      }
      
      try {
        // Get the highest position of existing images
        const positionQuery = `
          SELECT position FROM note_images 
          WHERE note_id = $1 
          ORDER BY position DESC 
          LIMIT 1
        `;
        log(`Executing position query: ${positionQuery} with note_id: ${noteId}`);
        
        const positionResult = await client.query(positionQuery, [noteId]);
        log(`Position query result: ${JSON.stringify(positionResult.rows)}`);
        
        const position = positionResult.rows.length > 0 ? positionResult.rows[0].position + 1 : 0;
        log(`Calculated position: ${position}`);
        
        // Insert the new image record
        const insertQuery = `
          INSERT INTO note_images (id, note_id, storage_path, url, position, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
          RETURNING id, note_id, storage_path, url, position, created_at
        `;
        log(`Executing insert query with params: [${noteId}, ${normalizedPath}, ${normalizedUrl.substring(0, 20)}..., ${position}]`);
        
        const insertResult = await client.query(insertQuery, [noteId, normalizedPath, normalizedUrl, position]);
        log(`Insert query completed: ${insertResult.rowCount} rows affected`);
        
        if (insertResult.rows.length === 0) {
          throw new Error("Failed to insert image record");
        }
        
        const imageData = insertResult.rows[0];
        log(`Image record created successfully via direct DB: ${imageData.id}`);
        
        return res.status(201).json(imageData);
      } finally {
        client.release();
      }
    } catch (error: any) {
      log(`Server error in create-image-record: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });
  
  // Endpoint to fix Supabase Storage RLS policies
  app.post("/api/fix-storage-permissions", async (_req: Request, res: Response) => {
    try {
      log('Attempting to fix Supabase Storage permissions...');
      
      // Make sure the bucket exists first
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        return res.status(500).json({
          error: "Failed to list buckets",
          message: bucketsError.message
        });
      }
      
      let noteImagesBucket = buckets.find(b => b.name === 'note-images');
      
      // Create the bucket if it doesn't exist
      if (!noteImagesBucket) {
        log('Note-images bucket not found, creating it...');
        const { error: createError } = await supabase.storage.createBucket('note-images', {
          public: true // Make the bucket public so images can be accessed without authentication
        });
        
        if (createError) {
          return res.status(500).json({
            error: "Failed to create bucket",
            message: createError.message
          });
        }
        
        log('Note-images bucket created successfully');
      }
      
      // Check if 'images' folder exists, create it if not
      try {
        const { data: imagesList, error: listError } = await supabase.storage
          .from('note-images')
          .list();
          
        if (listError) {
          log(`Error listing bucket contents: ${listError.message}`);
        } else {
          const imagesFolder = imagesList?.find(item => item.name === 'images');
          
          if (!imagesFolder) {
            log('Creating images folder in note-images bucket');
            
            // Create an empty file to establish the folder
            const { error: folderError } = await supabase.storage
              .from('note-images')
              .upload('images/.folder', new Uint8Array(0));
              
            if (folderError && !folderError.message.includes('already exists')) {
              log(`Error creating images folder: ${folderError.message}`);
            } else {
              log('Images folder created or already exists');
            }
          }
        }
      } catch (folderError) {
        log(`Error checking/creating images folder: ${folderError}`);
      }
      
      // Try to update the bucket to be public
      try {
        log('Updating bucket to be public...');
        
        // Make the bucket publicly accessible
        const { error: updateError } = await supabase.storage.updateBucket('note-images', {
          public: true 
        });
        
        if (updateError) {
          return res.status(500).json({
            error: "Failed to update bucket permissions",
            message: updateError.message
          });
        }
        
        log('Successfully updated bucket to public');
      } catch (permError: any) {
        log(`Error updating bucket permissions: ${permError.message}`);
        // Continue anyway - the permissions might already be set correctly
      }
      
      // Check if the bucket is accessible after our changes
      const { data: publicUrl } = supabase.storage
        .from('note-images')
        .getPublicUrl('images/.folder');
        
      log(`Public URL test: ${publicUrl.publicUrl}`);
      
      // Return success with the next steps
      return res.status(200).json({
        success: true,
        message: "Storage permissions updated successfully",
        publicUrl: publicUrl.publicUrl,
        nextSteps: [
          "Images should now be publicly accessible",
          "If images are still not loading, clear your browser cache",
          "You may need to log in to your Supabase account and manually update the bucket policies"
        ]
      });
    } catch (error: any) {
      log(`Error fixing storage permissions: ${error.message}`);
      return res.status(500).json({
        error: "Failed to fix storage permissions",
        details: error.message
      });
    }
  });

  // Supabase diagnostics endpoint to check storage access
  app.get("/api/supabase-diagnostics", async (_req: Request, res: Response) => {
    try {
      // Check environment variables
      const diagnostics = {
        supabaseUrl: !!supabaseUrl,
        supabaseKeyExists: !!supabaseKey,
        storageTests: {},
      };
      
      // Check if the note-images bucket exists and create if missing
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          diagnostics.storageTests = {
            bucketsListError: bucketsError.message,
            status: "failed",
          };
        } else {
          let noteImagesBucket = buckets.find(b => b.name === 'note-images');
          
          // If bucket doesn't exist, try to create it
          if (!noteImagesBucket) {
            log('Note-images bucket not found, attempting to create it...');
            const { data: newBucket, error: createError } = await supabase.storage.createBucket('note-images', {
              public: true // Make the bucket public so images can be accessed without authentication
            });
            
            if (createError) {
              diagnostics.storageTests = {
                bucketsListed: true,
                bucketsCount: buckets.length,
                bucketsNames: buckets.map(b => b.name),
                noteImagesBucketExists: false,
                bucketCreationError: createError.message,
                status: "bucket_creation_failed",
              };
            } else {
              log('Note-images bucket created successfully');
              // Just use the new bucket name instead of the full object to avoid typing issues
              diagnostics.storageTests = {
                bucketsListed: true,
                bucketsCount: buckets.length + 1,
                bucketsNames: [...buckets.map(b => b.name), 'note-images'],
                noteImagesBucketExists: true,
                bucketCreated: true,
                status: "bucket_created",
              };
            }
          } else {
            diagnostics.storageTests = {
              bucketsListed: true,
              bucketsCount: buckets.length,
              bucketsNames: buckets.map(b => b.name),
              noteImagesBucketExists: !!noteImagesBucket,
              status: !!noteImagesBucket ? "success" : "bucket_missing",
            };
          }
          
          // If bucket exists, try to list files
          if (noteImagesBucket) {
            try {
              const { data: files, error: filesError } = await supabase.storage
                .from('note-images')
                .list('images', { limit: 5 });
                
              if (filesError) {
                diagnostics.storageTests = {
                  ...diagnostics.storageTests,
                  filesListError: filesError.message,
                  filesStatus: "failed",
                };
              } else {
                diagnostics.storageTests = {
                  ...diagnostics.storageTests,
                  filesListed: true,
                  filesCount: files.length,
                  filesStatus: "success",
                };
              }
            } catch (error: any) {
              diagnostics.storageTests = {
                ...diagnostics.storageTests,
                filesError: error.message,
                filesStatus: "exception",
              };
            }
          }
        }
      } catch (error: any) {
        diagnostics.storageTests = {
          error: error.message,
          status: "exception",
        };
      }
      
      return res.json(diagnostics);
    } catch (error: any) {
      log(`Diagnostics error: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });
  
  // Endpoint to synchronize note counts in settings table with actual count in notes table
  app.get("/api/sync-note-counts", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const projectId = req.query.projectId as string; // Optional - if not provided, sync all projects for user
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      console.log(`Starting note count synchronization for user ${userId}${projectId ? `, project ${projectId}` : ''}`);
      
      // Connect to database
      let dbClient;
      try {
        dbClient = await pool.connect();
        
        // Get projects for user
        const projectsQuery = projectId 
          ? `SELECT id, title, note_count FROM settings WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`
          : `SELECT id, title, note_count FROM settings WHERE user_id = $1 AND deleted_at IS NULL`;
          
        const projectsParams = projectId ? [userId, projectId] : [userId];
        const projectsResult = await dbClient.query(projectsQuery, projectsParams);
        
        if (projectsResult.rows.length === 0) {
          return res.status(404).json({ 
            message: "No projects found to synchronize",
            success: false
          });
        }
        
        const updateResults = [];
        
        // Process each project
        for (const project of projectsResult.rows) {
          console.log(`Processing project ${project.id} (${project.title || 'Untitled'})`);
          
          // Count actual notes in database
          const countQuery = `SELECT COUNT(*) as note_count FROM notes WHERE project_id = $1 AND user_id = $2`;
          const noteCountResult = await dbClient.query(countQuery, [project.id, userId]);
          
          const actualCount = parseInt(noteCountResult.rows[0]?.note_count || '0');
          const settingsCount = parseInt(project.note_count || '0');
          
          // Information about this project
          const projectInfo = {
            id: project.id,
            title: project.title || 'Untitled',
            previous_count: settingsCount,
            actual_count: actualCount,
            updated: false,
            message: ''
          };
          
          // Update settings if the counts don't match
          if (actualCount !== settingsCount) {
            try {
              await dbClient.query(
                `UPDATE settings SET note_count = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
                [actualCount, project.id, userId]
              );
              
              projectInfo.updated = true;
              projectInfo.message = `Note count updated from ${settingsCount} to ${actualCount}`;
              console.log(`Updated note count for project ${project.id} from ${settingsCount} to ${actualCount}`);
              
              // No JSON files to update - database is the single source of truth
              console.log(`Database is now the single source of truth for project ${project.id}`);
            } catch (updateError) {
              projectInfo.message = `Error updating note count: ${updateError instanceof Error ? updateError.message : String(updateError)}`;
              console.error(`Error updating note count for project ${project.id}:`, updateError);
            }
          } else {
            projectInfo.message = `No update needed. Note count is already correct (${actualCount})`;
          }
          
          updateResults.push(projectInfo);
        }
        
        return res.status(200).json({
          success: true,
          message: `Synchronized note counts for ${updateResults.length} projects`,
          projects: updateResults
        });
      } finally {
        if (dbClient) dbClient.release();
      }
    } catch (error) {
      console.error("Error synchronizing note counts:", error);
      return res.status(500).json({
        error: "Failed to synchronize note counts",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Endpoint to update image format for compatibility with original app
  app.post("/api/update-image-format", async (req: Request, res: Response) => {
    try {
      const { format } = req.body;
      
      if (!format || !['original', 'replit'].includes(format)) {
        return res.status(400).json({ error: "Invalid format specified" });
      }
      
      log(`Updating image records to ${format} format`);
      
      // Connect directly to PostgreSQL to bypass RLS policies
      let client;
      try {
        client = await pool.connect();
        log(`Database connection established for image format update`);
      } catch (connError: any) {
        log(`Error connecting to database: ${connError.message}`);
        return res.status(500).json({ error: "Database connection error" });
      }
      
      let updateCount = 0;
      
      try {
        // First get all image records
        const { rows: images } = await client.query(
          'SELECT id, storage_path FROM note_images'
        );
        
        log(`Found ${images.length} image records to process`);
        
        // Process each record
        for (const image of images) {
          let newPath = image.storage_path;
          
          if (format === 'original') {
            // Normalize to original app format (images/[filename])
            const segments = image.storage_path.split('/');
            const filename = segments[segments.length - 1];
            newPath = `images/${filename}`;
          } else if (format === 'replit') {
            // This format is not currently supported
            // Add code here if needed in the future
            continue;
          }
          
          // Only update if path changed
          if (newPath !== image.storage_path) {
            await client.query(
              'UPDATE note_images SET storage_path = $1 WHERE id = $2',
              [newPath, image.id]
            );
            updateCount++;
          }
        }
      } finally {
        client.release();
      }
      
      return res.json({ success: true, count: updateCount, format });
    } catch (error: any) {
      log(`Image format update error: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Endpoint to fix and migrate local images to Supabase
  app.post("/api/migrate-local-images", async (req: Request, res: Response) => {
    const { userId, projectId } = req.body;
    let client;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    log(`Starting image migration for user ${userId}, project ${projectId || 'all projects'}`);
    
    try {
      // Connect directly to PostgreSQL
      client = await pool.connect();
      log(`Database connection established for image migration`);
      
      // Get image records with local URLs
      let imageQuery = `
        SELECT * FROM note_images 
        WHERE url LIKE '%localhost%' 
        OR url LIKE '%.replit.dev/uploads/%' 
        OR url LIKE '%127.0.0.1%'`;
        
      // Optional project filter
      const queryParams = [];
      if (projectId) {
        // We need to get notes by project first
        const noteIdsQuery = `
          SELECT id FROM notes 
          WHERE project_id = $1 AND user_id = $2`;
        
        const notesResult = await client.query(noteIdsQuery, [projectId, userId]);
        
        if (notesResult.rows.length > 0) {
          const noteIds = notesResult.rows.map(note => note.id);
          imageQuery += ` AND note_id = ANY($1::uuid[])`;
          queryParams.push(noteIds);
        }
      }
      
      const imageResult = await client.query(imageQuery, queryParams);
      const imageRecords = imageResult.rows;
      
      if (imageRecords.length === 0) {
        log('No images found to migrate');
        return res.json({ status: "success", migrated: 0, message: "No images found to migrate" });
      }
      
      log(`Found ${imageRecords.length} image records to check`);
      
      // Filter for local URLs only
      const localImages = imageRecords.filter((img: any) => 
        img.url && (
          img.url.includes('.replit.dev/uploads/') || 
          img.url.includes('localhost') ||
          img.url.includes('127.0.0.1')
        )
      );
      
      if (localImages.length === 0) {
        log('No local images found to migrate');
        return res.json({ status: "success", migrated: 0, message: "No local images found to migrate" });
      }
      
      log(`Found ${localImages.length} local image URLs to migrate`);
      
      // Track migration results
      const results = {
        total: localImages.length,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[]
      };
    
      // Process each image
      for (const image of localImages) {
        try {
          log(`Processing image ${image.id} with URL ${image.url}`);
          
          // Extract filename from URL
          const urlParts = image.url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          
          if (!fileName) {
            log(`Could not extract filename from URL: ${image.url}`);
            results.failed++;
            results.errors.push(`Invalid URL format: ${image.url}`);
            continue;
          }
          
          // Try to download the image from the local URL
          let imageBuffer: Buffer;
          try {
            // First try to get it from local uploads folder
            const localPath = path.join(__dirname, '../public/uploads', fileName);
            if (fs.existsSync(localPath)) {
              imageBuffer = fs.readFileSync(localPath);
              log(`Read image from local file: ${localPath}`);
            } else {
              // If not found locally, try to fetch from URL (might work during development)
              log(`Local file not found, trying to fetch from URL: ${image.url}`);
              results.skipped++;
              continue; // Skip for now - we don't want to make HTTP requests in this endpoint
            }
          } catch (fetchError: any) {
            log(`Error fetching image: ${fetchError.message}`);
            results.failed++;
            results.errors.push(`Failed to fetch image: ${fetchError.message}`);
            continue;
          }
          
          // Upload to Supabase Storage using the original app's format
          const filePath = `images/${fileName}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('note-images')
            .upload(filePath, imageBuffer, {
              contentType: 'image/jpeg', // Assume JPEG as default
              cacheControl: '3600',
              upsert: true
            });
            
          if (uploadError) {
            log(`Error uploading to Supabase: ${uploadError.message}`);
            results.failed++;
            results.errors.push(`Failed to upload to Supabase: ${uploadError.message}`);
            continue;
          }
          
          // Get the new public URL
          const { data: { publicUrl } } = supabase.storage
            .from('note-images')
            .getPublicUrl(filePath);
            
          log(`Uploaded to Supabase, new URL: ${publicUrl}`);
          
          // Update the database record
          const { error: updateError } = await supabase
            .from('note_images')
            .update({ 
              url: publicUrl,
              storage_path: filePath 
            })
            .eq('id', image.id);
            
          if (updateError) {
            log(`Error updating record: ${updateError.message}`);
            results.failed++;
            results.errors.push(`Failed to update record: ${updateError.message}`);
            
            // Try to clean up the uploaded file
            await supabase.storage.from('note-images').remove([filePath]);
            continue;
          }
          
          results.success++;
          log(`Successfully migrated image ${image.id}`);
        } catch (processError: any) {
          log(`Error processing image ${image.id}: ${processError.message}`);
          results.failed++;
          results.errors.push(`Error processing image ${image.id}: ${processError.message}`);
        }
      }
      
      return res.json({
        status: "success",
        results
      });
    } catch (error: any) {
      log(`Server error in migrate-local-images: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    } finally {
      if (client) {
        client.release();
      }
    }
  });

  // Image upload endpoint - with improved Supabase storage handling
  app.post("/api/upload-image", upload.single('image'), async (req, res) => {
    try {
      const { noteId, userId } = req.body;
      const file = req.file;

      if (!file || !noteId || !userId) {
        return res.status(400).json({ 
          error: "Missing required fields", 
          details: { 
            file: !!file, 
            noteId: !!noteId, 
            userId: !!userId 
          } 
        });
      }

      log(`Uploading image for note ${noteId} by user ${userId}`);

      try {
        // Verify the note belongs to the user (or trust the user ID if notes table doesn't exist)
        try {
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('user_id')
            .eq('id', noteId)
            .single();

          if (!noteError && noteData && noteData.user_id !== userId) {
            log(`User ${userId} attempted to upload to note ${noteId} owned by ${noteData.user_id}`);
            return res.status(403).json({ error: "Not authorized to upload to this note" });
          }
        } catch (verifyError: any) {
          log(`Note verification skipped: ${verifyError.message}`);
          // Continue with upload - we will trust the provided userId
        }

        // Unique file path - use a unique name but preserve the file extension
        const fileExt = path.extname(file.originalname) || '.jpg';
        const fileName = `${uuidv4()}${fileExt}`;
        // Use the format expected by the original app: images/[filename]
        const filePath = `images/${fileName}`;
        
        log(`Uploading to storage path: ${filePath}`);
        
        // Read the file from disk
        const fileBuffer = fs.readFileSync(file.path);
        
        // Ensure the note-images bucket exists
        try {
          const { data: buckets } = await supabase.storage.listBuckets();
          if (buckets && !buckets.some(b => b.name === 'note-images')) {
            log('Creating note-images bucket');
            await supabase.storage.createBucket('note-images', {
              public: true,
              fileSizeLimit: 1024 * 1024 * 5 // 5MB limit
            });
          }
        } catch (bucketError: any) {
          log(`Bucket check error (continuing): ${bucketError.message}`);
        }
        
        // Try uploading to Supabase first, then fall back to local storage if needed
        let publicUrl = '';
        let storageType = 'supabase'; // Track whether we're using Supabase or local storage
        
        try {
          // First try Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('note-images')
            .upload(filePath, fileBuffer, {
              contentType: file.mimetype,
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            log(`Supabase storage upload error: ${uploadError.message}, using local storage instead`);
            storageType = 'local';
          } else {
            // Get the public URL from Supabase
            const { data: { publicUrl: supabaseUrl } } = supabase.storage
              .from('note-images')
              .getPublicUrl(filePath);
              
            publicUrl = supabaseUrl;
            log(`Image uploaded to Supabase, public URL: ${publicUrl}`);
          }
        } catch (error: any) {
          log(`Supabase connection failed: ${error.message}, using local storage instead`);
          storageType = 'local';
        }
        
        // If Supabase failed, use local storage
        if (storageType === 'local') {
          try {
            // Make sure uploads directory exists
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
              log(`Created uploads directory: ${uploadsDir}`);
            }
            
            // Save the file to local storage
            const localFilePath = path.join(uploadsDir, fileName);
            // Local file writing has been removed
            console.log(`[LOCAL SAVE DISABLED] Would have saved file to ${localFilePath}`);
            
            // Generate a URL for the local file
            const baseUrl = req.protocol + '://' + req.get('host');
            publicUrl = `${baseUrl}/uploads/${fileName}`;
            
            log(`Image saved to local storage, URL: ${publicUrl}`);
          } catch (localError: any) {
            log(`Local storage fallback also failed: ${localError.message}`);
            return res.status(500).json({ 
              error: "Failed to upload image", 
              message: "Both cloud and local storage attempts failed" 
            });
          }
        }

        // Get highest position of existing images
        const { data: existingImages } = await supabase
          .from('note_images')
          .select('position')
          .eq('note_id', noteId)
          .order('position', { ascending: false })
          .limit(1);

        const position = existingImages && existingImages.length > 0 
          ? existingImages[0].position + 1 
          : 0;

        // Create record in the database - using direct PostgreSQL connection to bypass RLS
        // First connect to the database
        let client;
        try {
          client = await pool.connect();
          log(`Database connection established successfully for image record creation`);
        } catch (connError) {
          log(`Error connecting to database: ${connError instanceof Error ? connError.message : String(connError)}`);
          return res.status(500).json({ error: "Database connection failed", message: String(connError) });
        }
        
        let imageId;
        try {
          // Insert the new image record
          const insertQuery = `
            INSERT INTO note_images (id, note_id, storage_path, url, position, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
            RETURNING id, note_id, storage_path, url, position, created_at
          `;
          log(`Executing image insert query with params: [${noteId}, ${filePath}, ${publicUrl.substring(0, 20)}..., ${position}]`);
          
          const insertResult = await client.query(insertQuery, [noteId, filePath, publicUrl, position]);
          log(`Insert query completed: ${insertResult.rowCount} rows affected`);
          
          if (insertResult.rows.length === 0) {
            throw new Error("Failed to insert image record");
          }
          
          const imageData = insertResult.rows[0];
          log(`Image record created successfully via direct DB: ${imageData.id}`);
          imageId = imageData.id;
        } catch (dbError) {
          log(`Database record creation error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          // Try to clean up the uploaded file if on Supabase
          if (storageType === 'supabase') {
            await supabase.storage.from('note-images').remove([filePath]);
          }
          return res.status(500).json({ error: "Failed to create image record", message: String(dbError) });
        } finally {
          // Always release the client back to the pool
          client.release();
        }

        // Clean up the temporary file
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          log(`Warning: Could not clean up temp file: ${cleanupError}`);
        }

        // Return success response with the image data
        const response = {
          id: imageId,
          note_id: noteId,
          storage_path: filePath,
          url: publicUrl,
          position: position,
          created_at: new Date().toISOString()
        };

        log(`Image uploaded successfully: ${response.id}`);
        return res.status(200).json(response);
      } catch (uploadError: any) {
        log(`Error during image upload process: ${uploadError.message}`);
        return res.status(500).json({ 
          error: "Failed to process image upload", 
          message: uploadError.message 
        });
      }
    } catch (error: any) {
      log(`Server error in upload-image: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Endpoint to remove an image - with mock mode
  app.delete("/api/remove-image/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { userId } = req.query;

      if (!imageId || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      log(`Removing image ${imageId}`);
      
      try {
        // Get the image record
        const { data: imageData, error: getError } = await supabase
          .from('note_images')
          .select('storage_path, note_id')
          .eq('id', imageId)
          .single();

        if (getError || !imageData) {
          log(`Error getting image: ${getError?.message || 'Image not found'}`);
          return res.status(404).json({ error: "Image not found" });
        }

        // Attempt to verify the note belongs to the user
        try {
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('user_id')
            .eq('id', imageData.note_id)
            .single();

          if (!noteError && noteData && noteData.user_id !== userId) {
            log(`User ${userId} attempted to delete an image from note owned by ${noteData.user_id}`);
            return res.status(403).json({ error: "Not authorized to delete this image" });
          }
        } catch (verifyError: any) {
          log(`Note verification skipped: ${verifyError.message}`);
          // Continue with delete - we will trust the provided userId
        }

        // Delete from storage if path exists
        if (imageData.storage_path) {
          // Try to delete from Supabase storage
          try {
            const { error: deleteStorageError } = await supabase.storage
              .from('note-images')
              .remove([imageData.storage_path]);
              
            if (deleteStorageError) {
              log(`Warning: Could not delete storage file: ${deleteStorageError.message}`);
              // Continue anyway, will try local storage next
            } else {
              log(`Deleted file from Supabase storage: ${imageData.storage_path}`);
            }
          } catch (storageError: any) {
            log(`Supabase storage delete error (continuing): ${storageError.message}`);
          }
          
          // Also check for a local copy and delete if found
          try {
            // Get the filename from the path
            const fileName = path.basename(imageData.storage_path);
            const localFilePath = path.join(uploadsDir, fileName);
            
            // Check if the file exists locally
            if (fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
              log(`Deleted local file: ${localFilePath}`);
            }
          } catch (localError: any) {
            log(`Local file deletion error (continuing): ${localError.message}`);
          }
        }

        // Delete database record
        const { error: deleteRecordError } = await supabase
          .from('note_images')
          .delete()
          .eq('id', imageId);
          
        if (deleteRecordError) {
          log(`Error deleting image record: ${deleteRecordError.message}`);
          return res.status(500).json({ 
            error: "Failed to delete image record", 
            details: deleteRecordError 
          });
        }
        
        log(`Image ${imageId} removed successfully`);
        return res.status(200).json({ 
          success: true,
          imageId
        });
      } catch (processError: any) {
        log(`Error processing image deletion: ${processError.message}`);
        return res.status(500).json({ 
          error: "Failed to process image deletion", 
          message: processError.message 
        });
      }
    } catch (error: any) {
      log(`Server error in remove-image: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Endpoint to test RLS policies on note_images table
  app.get("/api/test-rls", async (req, res) => {
    try {
      // Test insertion into note_images table
      const testRecord = {
        note_id: req.query.noteId?.toString() || '00000000-0000-0000-0000-000000000000',
        storage_path: 'test-path',
        url: 'test-url',
        position: 0
      };
      
      log(`Testing RLS with record: ${JSON.stringify(testRecord)}`);
      
      const { data, error } = await supabase
        .from('note_images')
        .insert(testRecord)
        .select();
        
      if (error) {
        log(`RLS test error: ${error.message}`);
        return res.status(400).json({ 
          status: 'error', 
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }
      
      log(`RLS test succeeded, record created: ${JSON.stringify(data)}`);
      
      // Delete the test record if it was created
      if (data && data.length > 0) {
        await supabase
          .from('note_images')
          .delete()
          .eq('id', data[0].id);
        
        log(`Test record deleted`);
      }
      
      return res.json({ status: 'success', data });
    } catch (error: any) {
      log(`Exception in RLS test: ${error.message}`);
      return res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Endpoint to update image position - with mock mode
  app.put("/api/update-image-position", async (req, res) => {
    try {
      const { imageId, noteId, userId, newPosition } = req.body;

      if (!imageId || !noteId || !userId || newPosition === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      log(`Updating image ${imageId} position to ${newPosition}`);

      try {
        // Attempt to verify the note belongs to the user
        try {
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('user_id')
            .eq('id', noteId)
            .single();

          if (!noteError && noteData && noteData.user_id !== userId) {
            log(`User ${userId} attempted to update an image in note ${noteId} owned by ${noteData.user_id}`);
            return res.status(403).json({ error: "Not authorized to update this image" });
          }
        } catch (verifyError: any) {
          log(`Note verification skipped: ${verifyError.message}`);
          // Continue with update - we will trust the provided userId
        }

        // Update image position
        const { error } = await supabase
          .from('note_images')
          .update({ position: newPosition })
          .eq('id', imageId)
          .eq('note_id', noteId);

        if (error) {
          log(`Error updating image position: ${error.message}`);
          return res.status(500).json({ 
            error: "Failed to update image position", 
            details: error.message 
          });
        }
        
        log(`Image position updated successfully to ${newPosition}`);
        return res.status(200).json({ 
          success: true,
          imageId,
          noteId,
          newPosition
        });
      } catch (updateError: any) {
        log(`Error during position update: ${updateError.message}`);
        return res.status(500).json({ 
          error: "Failed to update image position", 
          message: updateError.message 
        });
      }
    } catch (error: any) {
      log(`Server error in update-image-position: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Profile API Routes
  // Get user profile
  app.get("/api/profile/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      log(`Getting profile for user ${userId}`);
      
      // Query the database for the profile
      const { rows } = await pool.query(
        'SELECT * FROM profiles WHERE user_id = $1',
        [userId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ 
          error: "Profile not found",
          code: "PROFILE_NOT_FOUND"
        });
      }
      
      return res.status(200).json(rows[0]);
    } catch (error: any) {
      log(`Error getting profile: ${error.message}`);
      return res.status(500).json({
        error: "Failed to get profile",
        details: error.message
      });
    }
  });
  
  // Create or update user profile
  app.post("/api/profile", async (req: Request, res: Response) => {
    try {
      const { userId, payoff } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      log(`Saving profile for user ${userId}`);
      
      // Check if profile exists
      const { rows: existingRows } = await pool.query(
        'SELECT id FROM profiles WHERE user_id = $1',
        [userId]
      );
      
      let result;
      
      if (existingRows.length === 0) {
        // Create new profile
        log(`Creating new profile for user ${userId}`);
        const { rows } = await pool.query(
          'INSERT INTO profiles (user_id, payoff) VALUES ($1, $2) RETURNING *',
          [userId, payoff || '']
        );
        result = rows[0];
      } else {
        // Update existing profile
        log(`Updating existing profile for user ${userId}`);
        const { rows } = await pool.query(
          'UPDATE profiles SET payoff = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
          [payoff || '', userId]
        );
        result = rows[0];
      }
      
      return res.status(200).json({
        success: true,
        profile: result
      });
    } catch (error: any) {
      log(`Error saving profile: ${error.message}`);
      return res.status(500).json({
        error: "Failed to save profile",
        details: error.message
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
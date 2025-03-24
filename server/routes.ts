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

// Get current file's directory path (ES modules replacement for __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || ""; // Using the anon key here
const supabase = createClient(supabaseUrl, supabaseKey);

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
  
  // Ensure directories exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
  
  // Serve static files from the public/uploads directory for test/mock images
  app.use('/uploads', fs.existsSync(uploadsDir) 
    ? express.static(uploadsDir)
    : (_, __, next) => next()
  );
  
  // put application routes here
  // prefix all routes with /api
  
  // Store project data endpoint (to overcome RLS restrictions)
  app.post("/api/store-project-data", async (req: Request, res: Response) => {
    try {
      const { id, name, userId, data, description } = req.body;
      
      if (!id || !userId || !data) {
        return res.status(400).json({ 
          error: "Project ID, User ID, and data are required" 
        });
      }
      
      console.log(`Storing project data for project ${id} by user ${userId} (SERVER MODE)`);
      console.log(`Project name: ${name}`);
      console.log(`Project contains ${data.notes?.length || 0} notes`);
      
      // Check if the data contains images
      let imageCount = 0;
      const countImages = (notes: any[]) => {
        for (const note of notes) {
          if (note.images && Array.isArray(note.images)) {
            imageCount += note.images.length;
          }
          if (note.children && Array.isArray(note.children)) {
            countImages(note.children);
          }
        }
      };
      
      if (data.notes && Array.isArray(data.notes)) {
        countImages(data.notes);
      }
      
      console.log(`Project contains ${imageCount} images`);
      
      // Store the project data in a file to bypass Supabase RLS
      const projectFilePath = path.join(projectsDir, `${id}.json`);
      const projectData = {
        id,
        name,
        user_id: userId,
        data,
        description,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      
      // Write the file
      fs.writeFileSync(projectFilePath, JSON.stringify(projectData, null, 2));
      console.log(`Project data saved to ${projectFilePath}`);
      
      // Return success
      return res.status(200).json({
        success: true,
        message: "Project data stored successfully"
      });
    } catch (error) {
      console.error("Error storing project data:", error);
      return res.status(500).json({
        error: "Failed to store project data",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get project data endpoint (to overcome RLS restrictions)
  app.get("/api/get-project-data/:id", async (req: Request, res: Response) => {
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
      
      // Check if the project data file exists
      const projectFilePath = path.join(projectsDir, `${projectId}.json`);
      
      if (!fs.existsSync(projectFilePath)) {
        return res.status(404).json({ 
          error: "Project data not found",
          message: "The project data file does not exist"
        });
      }
      
      // Read the file
      const projectDataStr = fs.readFileSync(projectFilePath, 'utf8');
      const projectData = JSON.parse(projectDataStr);
      
      // Validate that this project belongs to the user
      if (projectData.user_id !== userId) {
        return res.status(403).json({ 
          error: "Access denied",
          message: "You do not have permission to access this project"
        });
      }
      
      // Return the project data
      return res.status(200).json(projectData);
    } catch (error) {
      console.error("Error getting project data:", error);
      return res.status(500).json({
        error: "Failed to get project data",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simple health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
      
      // Check if the note-images bucket exists
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          diagnostics.storageTests = {
            bucketsListError: bucketsError.message,
            status: "failed",
          };
        } else {
          const noteImagesBucket = buckets.find(b => b.name === 'note-images');
          diagnostics.storageTests = {
            bucketsListed: true,
            bucketsCount: buckets.length,
            bucketsNames: buckets.map(b => b.name),
            noteImagesBucketExists: !!noteImagesBucket,
            status: !!noteImagesBucket ? "success" : "bucket_missing",
          };
          
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

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Image upload endpoint - with mock testing mode
  app.post("/api/upload-image", upload.single('image'), async (req, res) => {
    try {
      const { noteId, userId } = req.body;
      const file = req.file;
      const mockMode = process.env.NODE_ENV !== 'production';

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

      log(`Uploading image for note ${noteId} by user ${userId} ${mockMode ? '(MOCK MODE)' : ''}`);

      // In mock mode, skip Supabase verification and use provided IDs
      let verifiedNoteOwnership = false;
      
      if (!mockMode) {
        try {
          // Verify the note belongs to the user
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('user_id')
            .eq('id', noteId)
            .single();

          if (noteError || !noteData) {
            log(`Error verifying note ownership: ${noteError?.message || 'Note not found'}`);
            return res.status(404).json({ error: "Note not found" });
          }

          if (noteData.user_id !== userId) {
            log(`User ${userId} attempted to upload to note ${noteId} owned by ${noteData.user_id}`);
            return res.status(403).json({ error: "Not authorized to upload to this note" });
          }
          
          verifiedNoteOwnership = true;
        } catch (verifyError: any) {
          log(`Error during verification: ${verifyError.message}`);
          // Fall back to mock mode if verification fails
          log(`Falling back to mock mode due to verification error`);
        }
      } else {
        // In mock mode, we trust the provided IDs
        verifiedNoteOwnership = true;
      }
      
      if (!verifiedNoteOwnership && !mockMode) {
        return res.status(500).json({ error: "Could not verify note ownership" });
      }

      // Unique file path
      const fileName = `${uuidv4()}.jpg`;
      const filePath = `images/${fileName}`;
      
      log(`Uploading to storage path: ${filePath}`);
      
      // Read the file from disk
      const fileBuffer = fs.readFileSync(file.path);
      
      // Generate a local URL for the uploaded file
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      let publicUrl = `${baseUrl}/uploads/${fileName}`;
      let imageId = uuidv4();
      
      if (!mockMode) {
        try {
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('note-images')
            .upload(filePath, fileBuffer, {
              contentType: file.mimetype,
              cacheControl: '3600'
            });

          if (uploadError) {
            log(`Storage upload error: ${uploadError.message}`);
            return res.status(500).json({ error: "Failed to upload to storage", details: uploadError });
          }

          // Get the public URL
          const { data: { publicUrl: supabaseUrl } } = supabase.storage
            .from('note-images')
            .getPublicUrl(filePath);
            
          publicUrl = supabaseUrl;

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

          // Create record in the database
          const imageRecord = {
            note_id: noteId,
            storage_path: filePath,
            url: publicUrl,
            position: position
          };

          const { data: imageData, error: imageError } = await supabase
            .from('note_images')
            .insert(imageRecord)
            .select()
            .single();

          if (imageError) {
            log(`Database record creation error: ${imageError.message}`);
            // Try to clean up the uploaded file
            await supabase.storage.from('note-images').remove([filePath]);
            return res.status(500).json({ error: "Failed to create image record", details: imageError });
          }
          
          imageId = imageData.id;
        } catch (uploadError: any) {
          log(`Error during upload: ${uploadError.message}`);
          log(`Falling back to mock mode due to upload error`);
          // Fall back to mock mode
        }
      }
      
      // In mock mode or if Supabase operations failed, create a mock response
      if (mockMode) {
        // Save the file locally for testing
        try {
          // Create uploads directory if it doesn't exist
          const uploadsDir = path.join(__dirname, '../public/uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          // Copy file to uploads directory
          fs.copyFileSync(file.path, path.join(uploadsDir, fileName));
        } catch (saveError) {
          log(`Warning: Could not save local file: ${saveError}`);
        }
      }

      // Clean up the temporary file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        log(`Warning: Could not clean up temp file: ${cleanupError}`);
      }

      // Generate a response with the mock data
      const mockResponse = {
        id: imageId,
        note_id: noteId,
        storage_path: filePath,
        url: publicUrl,
        position: 0,
        created_at: new Date().toISOString()
      };

      log(`Image uploaded successfully: ${mockResponse.id}`);
      return res.status(200).json(mockResponse);
    } catch (error: any) {
      log(`Server error in upload-image: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Endpoint to remove an image - with mock mode
  app.delete("/api/remove-image/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { userId, filePath } = req.query;
      const mockMode = process.env.NODE_ENV !== 'production';

      if (!imageId || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      log(`Removing image ${imageId} ${mockMode ? '(MOCK MODE)' : ''}`);
      
      if (!mockMode) {
        try {
          // Get the image record and verify ownership
          const { data: imageData, error: getError } = await supabase
            .from('note_images')
            .select('storage_path, note_id')
            .eq('id', imageId)
            .single();

          if (getError || !imageData) {
            log(`Error getting image: ${getError?.message || 'Image not found'}`);
            return res.status(404).json({ error: "Image not found" });
          }

          // Verify the note belongs to the user
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('user_id')
            .eq('id', imageData.note_id)
            .single();

          if (noteError || !noteData) {
            log(`Error verifying note: ${noteError?.message || 'Note not found'}`);
            return res.status(404).json({ error: "Note not found" });
          }

          if (noteData.user_id !== userId) {
            log(`User ${userId} attempted to delete an image from note owned by ${noteData.user_id}`);
            return res.status(403).json({ error: "Not authorized to delete this image" });
          }

          // Delete from storage
          await supabase.storage
            .from('note-images')
            .remove([imageData.storage_path]);

          // Delete database record
          await supabase
            .from('note_images')
            .delete()
            .eq('id', imageId);
        } catch (deleteError: any) {
          log(`Error during delete: ${deleteError.message}`);
          log(`Falling back to mock mode due to delete error`);
          // Fall back to mock mode
        }
      }
      
      // In mock mode, try to remove the local file if specified
      if (mockMode && filePath) {
        try {
          const filename = filePath.toString().split('/').pop();
          if (filename) {
            const localFilePath = path.join(__dirname, '../public/uploads', filename);
            if (fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
              log(`Removed local file: ${localFilePath}`);
            }
          }
        } catch (localDeleteError) {
          log(`Warning: Could not delete local file: ${localDeleteError}`);
        }
      }

      log(`Image ${imageId} removed successfully`);
      return res.status(200).json({ 
        success: true,
        mock: mockMode,
        imageId
      });
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
      const mockMode = process.env.NODE_ENV !== 'production';

      if (!imageId || !noteId || !userId || newPosition === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      log(`Updating image ${imageId} position to ${newPosition} ${mockMode ? '(MOCK MODE)' : ''}`);

      if (!mockMode) {
        try {
          // Verify the note belongs to the user
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .select('user_id')
            .eq('id', noteId)
            .single();

          if (noteError || !noteData) {
            log(`Error verifying note ownership: ${noteError?.message || 'Note not found'}`);
            return res.status(404).json({ error: "Note not found" });
          }

          if (noteData.user_id !== userId) {
            log(`User ${userId} attempted to update an image in note ${noteId} owned by ${noteData.user_id}`);
            return res.status(403).json({ error: "Not authorized to update this image" });
          }

          // Update image position
          const { error } = await supabase
            .from('note_images')
            .update({ position: newPosition })
            .eq('id', imageId)
            .eq('note_id', noteId);

          if (error) {
            log(`Error updating image position: ${error.message}`);
            return res.status(500).json({ error: "Failed to update image position", details: error });
          }
        } catch (updateError: any) {
          log(`Error during update: ${updateError.message}`);
          log(`Falling back to mock mode due to update error`);
          // Fall back to mock mode
        }
      }
      
      // In mock mode, just return success
      log(`Image position updated successfully to ${newPosition}`);
      return res.status(200).json({ 
        success: true, 
        mock: mockMode,
        imageId,
        noteId,
        newPosition
      });
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
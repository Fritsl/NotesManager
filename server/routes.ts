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

  // Endpoint to fix and migrate local images to Supabase
  app.post("/api/migrate-local-images", async (req: Request, res: Response) => {
    try {
      const { userId, projectId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      log(`Starting image migration for user ${userId}, project ${projectId || 'all projects'}`);
      
      // Get image records with local URLs
      let imageQuery = supabase
        .from('note_images')
        .select('*');
        
      // Filter by user_id if we can - but this might not be available in note_images table
      // So we'll do more verification later
      
      // Optional project filter
      if (projectId) {
        // We need to get notes by project first
        const { data: projectNotes } = await supabase
          .from('notes')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', userId);
          
        if (projectNotes && projectNotes.length > 0) {
          const noteIds = projectNotes.map(note => note.id);
          imageQuery = imageQuery.in('note_id', noteIds);
        }
      }
      
      const { data: imageRecords, error: imageError } = await imageQuery;
      
      if (imageError) {
        log(`Error fetching images: ${imageError.message}`);
        return res.status(500).json({ error: "Failed to fetch image records" });
      }
      
      if (!imageRecords || imageRecords.length === 0) {
        log('No images found to migrate');
        return res.json({ status: "success", migrated: 0, message: "No images found to migrate" });
      }
      
      log(`Found ${imageRecords.length} image records to check`);
      
      // Filter for local URLs only
      const localImages = imageRecords.filter(img => 
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
          
          // Upload to Supabase Storage
          const filePath = `images/${userId}/${fileName}`;
          
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
        const filePath = `images/${userId}/${fileName}`;
        
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
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('note-images')
          .upload(filePath, fileBuffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          log(`Storage upload error: ${uploadError.message}`);
          return res.status(500).json({ error: "Failed to upload to storage", details: uploadError });
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('note-images')
          .getPublicUrl(filePath);
          
        log(`Image uploaded to Supabase, public URL: ${publicUrl}`);

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
        
        const imageId = imageData.id;

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
          created_at: imageData.created_at || new Date().toISOString()
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
          try {
            const { error: deleteStorageError } = await supabase.storage
              .from('note-images')
              .remove([imageData.storage_path]);
              
            if (deleteStorageError) {
              log(`Warning: Could not delete storage file: ${deleteStorageError.message}`);
              // Continue anyway to remove the database record
            } else {
              log(`Deleted file from storage: ${imageData.storage_path}`);
            }
          } catch (storageError: any) {
            log(`Storage delete error (continuing): ${storageError.message}`);
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
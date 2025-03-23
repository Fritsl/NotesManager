import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { log } from "./vite";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import os from "os";

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || ""; // Using the anon key here
const supabase = createClient(supabaseUrl, supabaseKey);

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
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Image upload endpoint
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

      // Unique file path in storage
      const filePath = `${userId}/${noteId}/${uuidv4()}-${path.basename(file.filename)}`;
      
      // Read the file from disk
      const fileBuffer = fs.readFileSync(file.path);
      
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
      const { data: { publicUrl } } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);

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

      // Clean up the temporary file
      fs.unlinkSync(file.path);

      log(`Image uploaded successfully: ${imageData.id}`);
      return res.status(200).json(imageData);
    } catch (error: any) {
      log(`Server error in upload-image: ${error.message}`);
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Endpoint to remove an image
  app.delete("/api/remove-image/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { userId } = req.query;

      if (!imageId || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get the image record and verify ownership
      const { data: imageData, error: getError } = await supabase
        .from('note_images')
        .select('storage_path, note_id')
        .eq('id', imageId)
        .single();

      if (getError || !imageData) {
        return res.status(404).json({ error: "Image not found" });
      }

      // Verify the note belongs to the user
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('user_id')
        .eq('id', imageData.note_id)
        .single();

      if (noteError || !noteData) {
        return res.status(404).json({ error: "Note not found" });
      }

      if (noteData.user_id !== userId) {
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

      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  // Endpoint to update image position
  app.put("/api/update-image-position", async (req, res) => {
    try {
      const { imageId, noteId, userId, newPosition } = req.body;

      if (!imageId || !noteId || !userId || newPosition === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify the note belongs to the user
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('user_id')
        .eq('id', noteId)
        .single();

      if (noteError || !noteData) {
        return res.status(404).json({ error: "Note not found" });
      }

      if (noteData.user_id !== userId) {
        return res.status(403).json({ error: "Not authorized to update this image" });
      }

      // Update image position
      const { error } = await supabase
        .from('note_images')
        .update({ position: newPosition })
        .eq('id', imageId)
        .eq('note_id', noteId);

      if (error) {
        return res.status(500).json({ error: "Failed to update image position", details: error });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: "Server error", message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

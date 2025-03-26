import { supabase } from './supabase';
import { NoteImage } from '../types/notes';

/**
 * Helper function to normalize image paths for cross-app compatibility
 * Handles duplicate 'images/' segments and ensures consistent format
 */
export function normalizeImagePath(path: string): string {
  // Remove any duplicate 'images/' segments
  if (path.includes('/images/images/') || path.includes('images/images/')) {
    console.log(`Fixing double path segments in path: ${path}`);
    const pathParts = path.split('/');
    const fileNamePart = pathParts[pathParts.length - 1];
    return `images/${fileNamePart}`;
  }
  
  // Ensure path starts with 'images/'
  if (!path.startsWith('images/')) {
    console.log(`Adding images/ prefix to path: ${path}`);
    const pathParts = path.split('/');
    const fileNamePart = pathParts[pathParts.length - 1];
    return `images/${fileNamePart}`;
  }
  
  return path;
}

/**
 * Helper function to normalize image URLs for cross-app compatibility
 * Handles URLs with duplicate 'images/' segments
 */
export function normalizeImageUrl(url: string): string {
  try {
    if (url && url.includes('/images/images/')) {
      console.log(`Fixing double path segments in URL: ${url}`);
      const urlObj = new URL(url);
      const newPath = urlObj.pathname.replace('/images/images/', '/images/');
      return url.replace(urlObj.pathname, newPath);
    }
    return url;
  } catch (e) {
    // If URL parsing fails, keep original URL
    console.warn(`Failed to parse and normalize URL: ${url}`, e);
    return url;
  }
}

/**
 * Add an image to a note
 * Handles uploading to Supabase storage and creating a database record
 * Uses the standardized format required for cross-app compatibility
 */
export async function addImageToNote(noteId: string, file: File): Promise<NoteImage | null> {
  try {
    console.log(`Adding image to note ${noteId}`);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    const userId = userData.user.id;
    console.log(`User ID: ${userId}`);
    
    // Generate a unique filename with original extension
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    // CRITICAL: Use the format expected by the original app: images/[filename] - not images/user_id/filename
    // This is the exact format that must be used for compatibility with other applications
    let filePath = `images/${fileName}`;
    
    console.log('Uploading image directly to Supabase storage with path:', filePath);
    
    // Ensure the note-images bucket exists (this is a best-effort, may fail due to permissions)
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets && !buckets.some(b => b.name === 'note-images')) {
        console.log('Attempting to create note-images bucket');
        await supabase.storage.createBucket('note-images', {
          public: true,
          fileSizeLimit: 1024 * 1024 * 5 // 5MB limit
        });
      }
    } catch (bucketError) {
      console.warn('Bucket check/create error:', bucketError);
      // Continue anyway, as the bucket might already exist or be created by admin
    }
    
    // Normalize the file path to ensure consistent format
    // This fixes any issues with path formats before uploading
    filePath = normalizeImagePath(filePath);
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('note-images')
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error uploading to Supabase storage:', uploadError);
      return null;
    }
    
    // Get the public URL
    const urlResult = supabase.storage
      .from('note-images')
      .getPublicUrl(filePath);
    
    let publicUrl = urlResult.data.publicUrl;
    console.log('Image uploaded to Supabase, public URL:', publicUrl);
    
    // Use server API for the database part due to RLS policy restrictions
    console.log('Creating database record via server API');
    
    // Normalize the URL to ensure consistent format across applications
    publicUrl = normalizeImageUrl(publicUrl);
    
    // Create a FormData object with just the metadata (not the file)
    const formData = new FormData();
    formData.append('noteId', noteId);
    formData.append('userId', userId);
    formData.append('filePath', filePath);
    formData.append('publicUrl', publicUrl);
    
    // Use the server-side API to handle the database insert
    const response = await fetch('/api/create-image-record', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'Unknown error', status: response.status };
      }
      
      console.error('Error creating image record via API:', errorData);
      // Clean up the uploaded file
      await supabase.storage.from('note-images').remove([filePath]);
      return null;
    }
    
    // Parse the successful response
    const imageData = await response.json();
    console.log('Image uploaded successfully:', imageData);
    
    // Return the image data
    return {
      id: imageData.id,
      note_id: imageData.note_id,
      storage_path: imageData.storage_path,
      url: imageData.url,
      position: imageData.position,
      created_at: imageData.created_at
    };
  } catch (error) {
    console.error('Error in addImageToNote:', error);
    return null;
  }
}

/**
 * Remove an image from a note
 * Handles checking for references to the image before deleting the storage file
 * This preserves images that are referenced by multiple notes
 */
export async function removeImageFromNote(imageId: string): Promise<boolean> {
  try {
    console.log(`Removing image with ID: ${imageId}`);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    const userId = userData.user.id;
    console.log(`User ID: ${userId}`);
    
    // Get the image record first to get the storage path
    // First, try a direct approach with specific ID
    let { data: imageData, error: getError } = await supabase
      .from('note_images')
      .select('storage_path, note_id')
      .eq('id', imageId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error on no results
    
    if (getError) {
      console.error('Error getting image record:', getError.message);
      return false;
    }
    
    // If no image found by ID, it might be that we have a simplified image format
    // from a different app, try a fallback approach
    if (!imageData) {
      console.log('No image found with ID, trying alternative approach...');
      
      // Instead of using the database, we'll rely on removing the image directly from local state
      // The actual record will be removed when the note is saved next time
      
      // Just proceed with a basic check that the imageId looks valid
      if (!imageId || typeof imageId !== 'string' || imageId.trim() === '') {
        console.error('Invalid image ID provided');
        return false;
      }
      
      // Create minimal imageData needed for storage removal
      // Check if this is already a storage path
      if (imageId.startsWith('images/')) {
        // This is already a storage path in the original app format
        imageData = {
          storage_path: imageId,
          note_id: 'unknown' // We don't need this for deletion, but it's required by our type
        };
      } else {
        // This is just an ID, we need to create a storage path
        const imgIdParts = imageId.split('/');
        const fileName = imgIdParts[imgIdParts.length - 1];
        
        imageData = {
          // Use the original app format: images/[filename]
          storage_path: `images/${fileName}`,
          note_id: 'unknown' // We don't need this for deletion, but it's required by our type
        };
      }
      
      console.log('Using fallback image data:', imageData);
    }
    
    // Normalize storage path to ensure consistent format
    if (imageData.storage_path) {
      imageData.storage_path = normalizeImagePath(imageData.storage_path);
    }
    
    // Skip notes table verification since it doesn't exist
    // The server API handles access verification
    console.log('Skipping notes table verification, relying on API authorization');
    
    // Check if other notes reference this image before deleting from storage
    // This prevents deleting images that might be referenced by other notes
    try {
      // Count references to this storage path
      const { count, error: countError } = await supabase
        .from('note_images')
        .select('id', { count: 'exact' })
        .eq('storage_path', imageData.storage_path);
      
      if (countError) {
        console.warn('Could not check for other references to this image:', countError.message);
      } else if (count && count > 1) {
        console.log(`Found ${count} references to this image - will only delete the database record, not the storage file`);
        // Skip storage deletion as other notes reference this image
        
        // Just delete the database record
        const { error: deleteRecordError } = await supabase
          .from('note_images')
          .delete()
          .eq('id', imageId);
        
        if (deleteRecordError) {
          console.error('Error deleting image record:', deleteRecordError);
          return false;
        }
        
        console.log('Image reference removed successfully (storage file preserved)');
        return true;
      }
    } catch (e) {
      console.warn('Error checking for image references:', e);
      // Continue with deletion attempt anyway
    }
    
    // Delete the file from storage only if no other references exist
    if (imageData.storage_path) {
      const { error: deleteStorageError } = await supabase.storage
        .from('note-images')
        .remove([imageData.storage_path]);
      
      if (deleteStorageError) {
        console.warn('Warning: Could not delete storage file:', deleteStorageError.message);
        // Continue anyway - might be already deleted or missing
      } else {
        console.log('Deleted file from Supabase storage:', imageData.storage_path);
      }
    }
    
    // Delete the database record
    const { error: deleteRecordError } = await supabase
      .from('note_images')
      .delete()
      .eq('id', imageId);
    
    if (deleteRecordError) {
      console.error('Error deleting image record:', deleteRecordError);
      return false;
    }
    
    console.log('Image removed successfully');
    return true;
  } catch (error) {
    console.error('Error in removeImageFromNote:', error);
    return false;
  }
}

/**
 * Update the position of an image within a note
 * This is used to reorder images in the UI
 */
export async function updateImagePosition(noteId: string, imageId: string, newPosition: number): Promise<boolean> {
  try {
    console.log(`Updating image ${imageId} position to ${newPosition} for note ${noteId}`);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    const userId = userData.user.id;
    console.log(`User ID: ${userId}`);
    
    // Skip notes table verification since it doesn't exist
    // The server API and Supabase RLS handle access verification
    console.log('Skipping notes table verification, relying on API authorization');
    
    // Update the image position directly in the database
    const { error: updateError } = await supabase
      .from('note_images')
      .update({ position: newPosition })
      .eq('id', imageId)
      .eq('note_id', noteId);
    
    if (updateError) {
      console.error('Error updating image position:', updateError);
      return false;
    }
    
    console.log('Image position updated successfully');
    return true;
  } catch (error) {
    console.error('Error in updateImagePosition:', error);
    return false;
  }
}

/**
 * Migrates local Replit image URLs to Supabase storage
 * This helps fix any images that were uploaded during development
 * @param projectId Optional project ID to limit migration to a specific project
 * @returns Object with migration results
 */
export async function migrateLocalImages(projectId?: string): Promise<any> {
  try {
    console.log(`Starting migration of local images${projectId ? ` for project ${projectId}` : ''}`);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      throw new Error('User not authenticated');
    }
    
    const userId = userData.user.id;
    
    // Call the migration API endpoint
    const response = await fetch('/api/migrate-local-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        projectId
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Migration API error:', errorText);
      throw new Error(`Migration failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Migration result:', result);
    
    return result;
  } catch (error) {
    console.error('Error migrating local images:', error);
    throw error;
  }
}
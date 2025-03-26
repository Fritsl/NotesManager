import { supabase } from './supabase';
import { Note, NotesData, NoteImage } from '../types/notes';
import { v4 as uuidv4 } from 'uuid';
import { isValidUrl, isValidYoutubeUrl } from './utils';
import * as imageService from './imageService';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  data: NotesData;
  description?: string; // Optional field for project description
  deleted_at?: string; // Timestamp when the project was moved to trash
}

// Re-export image functions for backward compatibility
export const addImageToNote = imageService.addImageToNote;
export const removeImageFromNote = imageService.removeImageFromNote;
export const updateImagePosition = imageService.updateImagePosition;
export const migrateLocalImages = imageService.migrateLocalImages;

// Interface for database note records
interface DbNote {
  id: string;
  content: string;
  user_id: string;
  project_id: string;
  parent_id: string | null;
  // The field can be either note_position (old data) or position (new schema)
  note_position?: number;
  position?: number;
  // Additional meta properties stored in _meta JSON
  _meta?: string;
  // Legacy properties that might exist in older records
  is_discussion?: boolean;
  time_set?: string | null;
  youtube_url?: string | null;
  url?: string | null;
  url_display_text?: string | null;
  created_at: string;
  updated_at: string;
}

// Function to build hierarchical notes from flat DB records
export function buildNoteHierarchy(flatNotes: DbNote[], imagesData?: any[] | null): Note[] {
  console.log('Building note hierarchy from flat notes:', flatNotes);
  
  if (!flatNotes || flatNotes.length === 0) {
    console.log('No notes to build hierarchy from');
    return [];
  }
  
  // First, sort by position
  const sortedNotes = [...flatNotes].sort((a, b) => {
    // Handle different field names (note_position vs position)
    const posA = a.note_position !== undefined ? a.note_position : (a.position ?? 0);
    const posB = b.note_position !== undefined ? b.note_position : (b.position ?? 0);
    return posA - posB;
  });
  
  // Create a map of noteId -> images[] if we have image data
  const imageMap = new Map<string, NoteImage[]>();
  if (imagesData && imagesData.length > 0) {
    imagesData.forEach(image => {
      if (!imageMap.has(image.note_id)) {
        imageMap.set(image.note_id, []);
      }
      imageMap.get(image.note_id)?.push({
        id: image.id,
        note_id: image.note_id,
        storage_path: image.storage_path,
        url: image.url,
        position: image.position,
        created_at: image.created_at
      });
    });
  }
  
  // Create a map to store the hierarchy
  const noteMap = new Map<string, Note>();
  
  // First pass: create Note objects without children
  sortedNotes.forEach(dbNote => {
    // Parse content that might contain metadata
    let contentText = dbNote.content;
    let metaData: any = {};
    
    try {
      // Check if content is JSON containing both text and metadata
      const contentObj = JSON.parse(dbNote.content);
      if (contentObj && typeof contentObj === 'object') {
        if (contentObj.text) {
          // New format: { text: "content", meta: {...} }
          contentText = contentObj.text;
          
          if (contentObj.meta) {
            metaData = contentObj.meta;
          }
        }
      }
    } catch (e) {
      // Not JSON or not in expected format, use content as-is
      // This handles legacy notes that aren't in JSON format
      console.log('Note content is not JSON or not in expected format, using as plain text');
    }
    
    // Use the correct position field and ensure it's always a number
    const position = dbNote.note_position !== undefined ? dbNote.note_position : (dbNote.position ?? 0);
    
    // Get images for this note if any
    const noteImages = imageMap.get(dbNote.id) || [];
    
    // Create Note object with all properties - prefer direct properties over metaData
    // This way we preserve the original formatting
    noteMap.set(dbNote.id, {
      id: dbNote.id,
      content: contentText,
      position: position,
      // Use direct properties first if they exist, then fall back to metadata
      is_discussion: dbNote.is_discussion || metaData.is_discussion || false,
      time_set: dbNote.time_set || metaData.time_set || null,
      youtube_url: dbNote.youtube_url || metaData.youtube_url || null,
      url: dbNote.url || metaData.url || null,
      url_display_text: dbNote.url_display_text || metaData.url_display_text || null,
      children: [],
      images: noteImages
    });
  });
  
  // Top-level notes array
  const rootNotes: Note[] = [];
  
  // Second pass: build the hierarchy
  sortedNotes.forEach(dbNote => {
    const note = noteMap.get(dbNote.id);
    if (!note) return; // Safety check
    
    if (dbNote.parent_id && noteMap.has(dbNote.parent_id)) {
      // This is a child note, add it to its parent's children array
      const parentNote = noteMap.get(dbNote.parent_id);
      if (parentNote) {
        parentNote.children.push(note);
      }
    } else {
      // This is a root level note
      rootNotes.push(note);
    }
  });
  
  // Final cleanup: ensure positions are sequential for each level
  const cleanPositions = (notes: Note[]): Note[] => {
    return notes.map((note, index) => ({
      ...note,
      position: index,
      children: cleanPositions(note.children),
      // Preserve the images array
      images: note.images || []
    }));
  };
  
  return cleanPositions(rootNotes);
}

// Function to flatten hierarchical notes to DB records
export function flattenNoteHierarchy(notes: Note[], projectId: string, userId: string): { notes: any[], images: any[] } {
  const flatNotes: any[] = [];
  const noteImages: any[] = []; // To collect all images that need to be preserved
  
  // Recursive function to process each note
  const processNote = (note: Note, parentId: string | null, level: number) => {
    // Create a DB record for this note
    const now = new Date().toISOString();
    
    // Extract plain text content if it's in JSON format
    let plainContent = note.content;
    try {
      // Check if content is already in JSON format with text property
      const contentObj = JSON.parse(note.content);
      if (contentObj && typeof contentObj === 'object' && contentObj.text) {
        // If content is in JSON format, extract the text property
        plainContent = contentObj.text;
        console.log('Extracted plain text from JSON content for note:', note.id);
      }
    } catch (e) {
      // Content is already plain text, no conversion needed
    }
    
    // Validate URL to ensure it meets database constraints
    let validUrl = note.url;
    if (validUrl && !isValidUrl(validUrl)) {
      console.warn(`Invalid URL in note ${note.id}: ${validUrl}, removing to prevent database errors`);
      validUrl = null;
    }
    
    // Validate YouTube URL
    let validYoutubeUrl = note.youtube_url;
    if (validYoutubeUrl && !isValidYoutubeUrl(validYoutubeUrl)) {
      console.warn(`Invalid YouTube URL in note ${note.id}: ${validYoutubeUrl}, removing to prevent database errors`);
      validYoutubeUrl = null;
    }
    
    // Use the correct field names based on the Supabase schema
    const dbNote = {
      id: note.id,
      // Store content as plain text without JSON wrapping for compatibility
      content: plainContent,
      user_id: userId,
      project_id: projectId,
      parent_id: parentId,
      // Use 'position' not 'note_position' as per Supabase schema
      position: note.position,
      // Also store these properties directly on the note for compatibility with the original system
      is_discussion: note.is_discussion || false,
      time_set: note.time_set,
      youtube_url: validYoutubeUrl,
      url: validUrl,
      url_display_text: validUrl ? note.url_display_text : null, // Only include display text if URL is valid
      created_at: now,
      updated_at: now
    };
    
    // Add to flat list
    flatNotes.push(dbNote);
    
    // Collect images if the note has any
    if (note.images && note.images.length > 0) {
      // Add each image to the noteImages array for insertion/preservation
      note.images.forEach(image => {
        // Normalize storage path to ensure compatibility with other apps
        // Standard format is "images/filename.ext" - no user IDs or duplicated segments
        let normalizedPath = image.storage_path;
        if (normalizedPath) {
          normalizedPath = imageService.normalizeImagePath(normalizedPath);
        }
        
        // Normalize URL in the same way
        let normalizedUrl = image.url;
        if (normalizedUrl && normalizedUrl.includes('/images/images/')) {
          normalizedUrl = imageService.normalizeImageUrl(normalizedUrl);
        }
        
        // CRITICAL: Always preserve the original image ID exactly as is
        // This ensures images are properly maintained across app refreshes
        noteImages.push({
          id: image.id, // Never generate a new ID for existing images
          note_id: note.id,
          storage_path: normalizedPath,
          url: normalizedUrl,
          position: image.position,
          created_at: image.created_at || now
        });
      });
    }
    
    // Process children recursively
    if (note.children && note.children.length > 0) {
      note.children.forEach(child => {
        processNote(child, note.id, level + 1);
      });
    }
  };
  
  // Start with top-level notes
  notes.forEach(note => {
    processNote(note, null, 0);
  });
  
  // Return both the flat notes and the collected images
  return { notes: flatNotes, images: noteImages };
}

export async function getProjects(): Promise<Project[]> {
  try {
    console.log('--- getProjects: Starting to fetch projects ---');
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return [];
    }
    
    console.log('Current user ID:', userData.user.id);
    
    // Query settings table for projects belonging to the current user
    console.log('Querying settings table for projects...');
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null) // Only get non-deleted projects
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
    
    console.log('Raw projects data from settings table:', data);
    console.log('Number of projects found:', data ? data.length : 0);

    // Create projects array with empty notes
    const projects: Project[] = data?.map(item => ({
      id: item.id,
      name: item.title || 'Untitled Project',
      created_at: item.created_at,
      updated_at: item.updated_at,
      user_id: item.user_id,
      description: item.description || '',
      data: { notes: [] } // Will be populated below
    })) || [];
    
    // For project list display, we don't need to load all notes data,
    // but we could fetch the first few notes for each project if needed
    
    return projects;
  } catch (error) {
    console.error('Error in getProjects:', error);
    return [];
  }
}

export async function getTrashedProjects(): Promise<Project[]> {
  try {
    console.log('--- getTrashedProjects: Starting to fetch trashed projects ---');
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return [];
    }
    
    // Query settings table for trashed projects belonging to the current user
    console.log('Querying settings table for trashed projects...');
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .not('deleted_at', 'is', null) // Only get trashed projects
      .order('deleted_at', { ascending: false }); // Show recently trashed first

    if (error) {
      console.error('Error fetching trashed projects:', error);
      return [];
    }
    
    console.log('Number of trashed projects found:', data ? data.length : 0);

    // Create projects array with empty notes
    const trashedProjects: Project[] = data?.map(item => ({
      id: item.id,
      name: item.title || 'Untitled Project',
      created_at: item.created_at,
      updated_at: item.updated_at,
      user_id: item.user_id,
      description: item.description || '',
      deleted_at: item.deleted_at, // Include the deletion timestamp
      data: { notes: [] } // We don't load notes for trashed projects in the list view
    })) || [];
    
    return trashedProjects;
  } catch (error) {
    console.error('Error in getTrashedProjects:', error);
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    console.log('getProject called with id:', id);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    console.log('Current user:', userData.user.id);
    
    // IMPORTANT: First try to load from the server API which contains the full data with images
    console.log('Attempting to load complete project data (with images) from server API');
    try {
      const response = await fetch(`/api/get-project-data/${id}?userId=${userData.user.id}`);
      
      if (response.ok) {
        const projectData = await response.json();
        console.log('✅ Found full project data with embedded images from API!');
        console.log('Project data:', projectData.name);
        console.log('Data structure:', 
          projectData.data && 
          typeof projectData.data === 'object' && 
          Array.isArray(projectData.data.notes) ? 
          `Contains ${projectData.data.notes.length} notes` : 
          'Invalid data structure'
        );
        
        // Count images in the project data
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
        
        if (projectData.data?.notes && Array.isArray(projectData.data.notes)) {
          countImages(projectData.data.notes);
        }
        
        console.log(`Project contains ${imageCount} images`);
        
        // Return complete project with embedded images directly from the API
        return {
          id: projectData.id,
          name: projectData.name,
          created_at: projectData.created_at || new Date().toISOString(),
          updated_at: projectData.updated_at || new Date().toISOString(),
          user_id: projectData.user_id || userData.user.id,
          description: projectData.description || '',
          data: projectData.data || { notes: [] }
        };
      }
    } catch (apiError) {
      console.error('Error loading project from API:', apiError);
      // Continue to fallback approach
    }
    
    // FALLBACK APPROACH: Load from separate database tables
    console.log('API load failed, falling back to database queries...');
    
    // First, get project metadata from settings table
    const { data: projectData, error: projectError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .maybeSingle();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return null;
    }
    
    if (!projectData) {
      console.log('Project not found:', id);
      return null;
    }
    
    console.log('Project metadata:', projectData);
    
    // Create basic project with empty notes array
    const project: Project = {
      id: projectData.id,
      name: projectData.title || 'Untitled Project',
      created_at: projectData.created_at,
      updated_at: projectData.updated_at,
      user_id: projectData.user_id,
      description: projectData.description || '',
      data: { notes: [] }
    };
    
    // A detailed project was requested
    return project;
  } catch (error) {
    console.error('Error in getProject:', error);
    return null;
  }
}

export async function createProject(name: string, notesData: NotesData): Promise<Project | null> {
  try {
    console.log('Creating new project with name:', name);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    // Generate a new UUID for the project
    const projectId = uuidv4();
    
    // Create timestamps
    const now = new Date().toISOString();
    
    // Sanitize project name
    const sanitizedName = sanitizeProjectName(name);
    console.log('Sanitized project name:', sanitizedName);
    
    // Insert project metadata into settings table
    const { data: projectData, error: projectError } = await supabase
      .from('settings')
      .insert({
        id: projectId,
        title: sanitizedName,
        user_id: userData.user.id,
        created_at: now,
        updated_at: now,
        last_modified_at: now
      })
      .select('*')
      .single();
      
    if (projectError) {
      console.error('Error creating project:', projectError);
      return null;
    }
    
    console.log('Project metadata created:', projectData);
    
    // Flatten the notes hierarchy for database storage
    const { notes: flatNotes, images: noteImages } = flattenNoteHierarchy(notesData.notes, projectId, userData.user.id);
    
    console.log('Flattened notes to store:', flatNotes);
    
    if (flatNotes.length > 0) {
      // We're using the server API for note storage anyway, so just wait for the
      // user to save notes if they provided any - this avoids double saving
      console.log('Skipping initial note insert for empty project');
    }
    
    // Return the created project with empty notes
    return {
      id: projectData.id,
      name: projectData.title,
      created_at: projectData.created_at,
      updated_at: projectData.updated_at,
      user_id: projectData.user_id,
      data: notesData
    };
  } catch (error) {
    console.error('Error in createProject:', error);
    return null;
  }
}

function sanitizeProjectName(name: string): string {
  // Start by trimming whitespace
  let sanitized = name.trim();
  
  // If name is empty after trimming, use a default name
  if (!sanitized) {
    return 'Untitled Project';
  }

  // The database has a title_characters_check constraint that requires ASCII-only characters
  // So we need to filter out non-ASCII characters and problematic ones in a single pass
  const originalName = sanitized;
  
  // Remove problematic characters in a single pass for efficiency
  sanitized = sanitized
    .replace(/[^\x00-\x7F]|[<>{}[\]\\\/]/g, '') // Remove both non-ASCII and problematic characters
    .trim();
  
  // Log a warning if we had to modify the name
  if (originalName !== sanitized) {
    console.warn('Project name contains characters that may cause database constraints:', originalName);
    console.log('Sanitized project name:', sanitized);
  }
      
  // If removing these characters made the name empty, use a default
  if (!sanitized) {
    return 'Untitled Project';
  }
  
  // Limit length to 100 characters (arbitrary but reasonable limit)
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
  return sanitized;
}

export async function updateProject(id: string, name: string, notesData: NotesData, description: string = ''): Promise<Project | null> {
  try {
    console.log('Updating project:', id);
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    // Ensure notes data is valid
    const validNotesData = notesData || { notes: [] };
    
    // Update timestamp
    const now = new Date().toISOString();
    
    // Sanitize project name
    const sanitizedName = sanitizeProjectName(name);
    console.log('Sanitized project name:', sanitizedName);
    
    // Update project metadata in settings table
    const { data: projectData, error: projectError } = await supabase
      .from('settings')
      .update({
        title: sanitizedName,
        description: description,
        updated_at: now,
        last_modified_at: now
      })
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .select('*')
      .single();
    
    if (projectError) {
      console.error('Error updating project metadata:', projectError);
      return null;
    }
    
    console.log('Project metadata updated:', projectData);
    
    // Use the server API to update the project data
    const response = await fetch('/api/store-project-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id,
        name: sanitizedName,
        userId: userData.user.id,
        data: validNotesData,
        description
      })
    });
    
    if (!response.ok) {
      console.error('Error updating project data via API:', await response.text());
      return null;
    }
    
    console.log('Project update completed successfully');
    
    // Return updated project with the hierarchical notes
    return {
      id: projectData.id,
      name: projectData.title,
      created_at: projectData.created_at,
      updated_at: projectData.updated_at,
      user_id: projectData.user_id,
      description: projectData.description || '',
      data: validNotesData
    };
  } catch (error) {
    console.error('Error in updateProject:', error);
    return null;
  }
}

export async function moveProjectToTrash(id: string): Promise<boolean> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    // Move project to trash by setting deleted_at timestamp
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('settings')
      .update({
        deleted_at: now,
        updated_at: now
      })
      .eq('id', id)
      .eq('user_id', userData.user.id); // Ensure user can only delete their own projects

    if (error) {
      console.error('Error moving project to trash:', error);
      return false;
    }

    console.log(`Project ${id} moved to trash successfully`);
    return true;
  } catch (error) {
    console.error('Error in moveProjectToTrash:', error);
    return false;
  }
}

export async function restoreProjectFromTrash(id: string): Promise<boolean> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    // Restore project by setting deleted_at to null
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('settings')
      .update({
        deleted_at: null,
        updated_at: now
      })
      .eq('id', id)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error restoring project from trash:', error);
      return false;
    }

    console.log(`Project ${id} restored from trash successfully`);
    return true;
  } catch (error) {
    console.error('Error in restoreProjectFromTrash:', error);
    return false;
  }
}

export async function permanentlyDeleteProject(id: string): Promise<boolean> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    // Skip direct note operations since the notes table doesn't exist
    console.log('Skipping direct notes table operations for deletion');
    
    // Instead, let's clean up only the images for this project using the server API
    try {
      // Call the API to cleanup images associated with the project
      const response = await fetch(`/api/cleanup-project-images?projectId=${id}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        console.error('Error cleaning up project images:', await response.text());
      } else {
        console.log('Project images cleanup response:', await response.json());
      }
    } catch (imageCleanupError) {
      console.error('Failed to clean up project images:', imageCleanupError);
      // Continue with deletion anyway
    }
    
    // Permanently delete the project from settings table
    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error permanently deleting project:', error);
      return false;
    }

    console.log(`Project ${id} permanently deleted`);
    return true;
  } catch (error) {
    console.error('Error in permanentlyDeleteProject:', error);
    return false;
  }
}

// Keep the original deleteProject function for backward compatibility
// but make it call the new moveProjectToTrash function
export async function deleteProject(id: string): Promise<boolean> {
  return moveProjectToTrash(id);
}
import { supabase } from './supabase';
import { Note, NotesData, NoteImage } from '../types/notes';
import { v4 as uuidv4 } from 'uuid';
import { isValidUrl, isValidYoutubeUrl } from './utils';

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
        // CRITICAL: Always preserve the original image ID exactly as is
        // This ensures images are properly maintained across app refreshes
        noteImages.push({
          id: image.id, // Never generate a new ID for existing images
          note_id: note.id,
          storage_path: image.storage_path,
          url: image.url,
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
          name: projectData.name || 'Untitled Project',
          created_at: projectData.created_at,
          updated_at: projectData.updated_at,
          user_id: projectData.user_id,
          description: projectData.description || '',
          data: projectData.data || { notes: [] }
        };
      } else {
        console.log('⚠️ API returned error:', response.status, response.statusText);
        console.log('Trying fallback to Supabase projects table...');
        
        // Try loading from projects table as a fallback
        const { data: fullProjectData, error: fullProjectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('user_id', userData.user.id)
          .single();
          
        if (fullProjectData && !fullProjectError) {
          console.log('✅ Found full project data with embedded images from Supabase!');
          
          // Query settings table for metadata
          const { data: settingsData } = await supabase
            .from('settings')
            .select('*')
            .eq('id', id)
            .eq('user_id', userData.user.id)
            .is('deleted_at', null)
            .single();
          
          // Return complete project with embedded images from projects table
          return {
            id: fullProjectData.id,
            name: fullProjectData.name || (settingsData?.title || 'Untitled Project'),
            created_at: fullProjectData.created_at,
            updated_at: fullProjectData.updated_at,
            user_id: fullProjectData.user_id,
            description: settingsData?.description || '',
            data: fullProjectData.data || { notes: [] }
          };
        }
        
        console.log('⚠️ No data found in projects table or error occurred:', fullProjectError);
        console.log('Falling back to notes table data loading...');
      }
    } catch (apiError) {
      console.error('Error fetching project data from API:', apiError);
      console.log('Falling back to notes table data loading...');
    }
    
    // Fallback to previous loading method if projects table doesn't have the data
    
    // Query settings table for project belonging to current user
    const { data: projectData, error: projectError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .single();

    if (projectError || !projectData) {
      console.error('Error fetching project from settings table:', projectError);
      return null;
    }
    
    console.log('Project found in settings:', projectData.title);

    // Now fetch notes for this project from the notes table
    console.log('Fetching notes for project:', id);
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', userData.user.id);
      
    // Fetch images for notes in this project
    console.log('Fetching images for notes in project:', id);
    const { data: imagesData, error: imagesError } = await supabase
      .from('note_images')
      .select('*')
      .in('note_id', notesData?.map(note => note.id) || [])
      .order('position', { ascending: true });
      
    if (imagesError) {
      console.error('Error fetching note images:', imagesError);
    } else {
      console.log('Fetched images count:', imagesData?.length || 0);
    }
    
    if (notesError) {
      console.error('Error fetching notes:', notesError);
      // Return the project even if we couldn't fetch notes
      return {
        id: projectData.id,
        name: projectData.title || 'Untitled Project',
        created_at: projectData.created_at,
        updated_at: projectData.updated_at,
        user_id: projectData.user_id,
        data: { notes: [] }
      };
    }
    
    console.log('Raw notes data from DB count:', notesData ? notesData.length : 0);
    if (notesData && notesData.length > 0) {
      console.log('First note sample:', notesData[0]);
      
      // Check if notes have the correct field names for buildNoteHierarchy
      const sampleNote = notesData[0];
      if (sampleNote && sampleNote.note_position !== undefined) {
        console.log('Notes have note_position field, using for hierarchy building');
      } else if (sampleNote && sampleNote.position !== undefined) {
        console.log('Notes have position field instead of note_position, remapping fields');
        // Remap field names if needed
        notesData.forEach(note => {
          note.note_position = note.position;
        });
      }
    } else {
      console.log('No notes found for this project');
    }
    
    // Convert flat notes to hierarchical structure with images
    const hierarchicalNotes = notesData ? buildNoteHierarchy(notesData, imagesData || undefined) : [];
    console.log('Hierarchical notes count:', hierarchicalNotes.length);
    
    // Format data for Project interface with notes
    const formattedProject = {
      id: projectData.id,
      name: projectData.title || 'Untitled Project',
      created_at: projectData.created_at,
      updated_at: projectData.updated_at,
      user_id: projectData.user_id,
      description: projectData.description || '',
      data: { 
        notes: hierarchicalNotes 
      }
    };
    
    console.log('Formatted project:', formattedProject.name, 'Notes count:', formattedProject.data.notes.length);
    console.log('Full project data loaded:', formattedProject.data);
    
    return formattedProject;
  } catch (error) {
    console.error('Error in getProject:', error);
    return null;
  }
}

export async function createProject(name: string, notesData: NotesData): Promise<Project | null> {
  try {
    console.log('--- createProject: Starting to create project ---');
    console.log('Project name:', name);
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    console.log('Current user ID:', userData.user.id);
    const now = new Date().toISOString();
    
    // Format data for settings table
    console.log('Creating project with notes data:', notesData);
    
    // Ensure notesData has proper structure
    const validNotesData = notesData && Array.isArray(notesData.notes) 
      ? notesData 
      : { notes: [] };
    
    console.log('Validated notes data for storage:', validNotesData);
    
    // Attempt to create the project, handling unique constraint violations
    let projectInsertResponse;
    let baseName = name;
    let currentName = baseName;
    let attempt = 0;
    const MAX_ATTEMPTS = 10;
    
    // Generate a timestamp suffix to ensure uniqueness if needed
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    
    // Try creating with original name first, then add numeric suffixes if needed
    while (!projectInsertResponse?.data && attempt < MAX_ATTEMPTS) {
      console.log(`Creating project attempt ${attempt + 1}/${MAX_ATTEMPTS} with name: "${currentName}"`);
      
      const projectFields = {
        title: currentName,
        user_id: userData.user.id,
        created_at: now,
        updated_at: now,
        last_modified_at: now,
        description: '',
        note_count: validNotesData.notes.length,
        last_level: 0
      };
      
      projectInsertResponse = await supabase
        .from('settings')
        .insert(projectFields)
        .select()
        .single();
        
      if (projectInsertResponse.error) {
        if (projectInsertResponse.error.code === '23505') { // Unique constraint violation
          attempt++;
          
          // After trying numbered suffixes, add timestamp to guarantee uniqueness
          if (attempt <= 5) {
            // Try with a new name, adding a numeric suffix
            currentName = `${baseName} (${attempt})`;
          } else {
            // Add timestamp to ensure uniqueness 
            currentName = `${baseName} (${timestamp}-${attempt - 5})`;
          }
          
          console.log(`Name already exists, trying again with: "${currentName}"`);
        } else {
          // Different error, break the loop
          console.error('Error creating project:', projectInsertResponse.error);
          break;
        }
      } else {
        // Success!
        console.log('Project created successfully with name:', currentName);
        break;
      }
    }
    
    // Check final result
    if (!projectInsertResponse?.data) {
      console.error('Failed to create project after multiple attempts:', projectInsertResponse?.error);
      
      // Return a more specific error to help debugging
      const errorMessage = projectInsertResponse?.error?.message || 'Unknown error';
      console.error(`Last error: ${errorMessage} (code: ${projectInsertResponse?.error?.code})`);
      return null;
    }
    
    const projectId = projectInsertResponse.data.id;
    
    // If there are notes, create them in the notes table
    if (validNotesData.notes.length > 0) {
      // Convert hierarchical notes to flat DB records
      const { notes: flatNotes, images: flatImages } = flattenNoteHierarchy(validNotesData.notes, projectId, userData.user.id);
      console.log('Flattened notes for DB insertion:', flatNotes.length, 'notes', 'and', flatImages.length, 'images');
      
      // Insert notes in batches to avoid payload size limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < flatNotes.length; i += BATCH_SIZE) {
        const batch = flatNotes.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${i/BATCH_SIZE + 1}/${Math.ceil(flatNotes.length/BATCH_SIZE)}, size: ${batch.length}`);
        
        const { error: notesError } = await supabase
          .from('notes')
          .insert(batch);
          
        if (notesError) {
          console.error(`Error inserting notes batch ${i/BATCH_SIZE + 1}:`, notesError);
          // Continue with next batch
        }
      }
      
      // Insert images if any
      if (flatImages.length > 0) {
        console.log('Inserting', flatImages.length, 'image records');
        
        // Insert images in batches too
        for (let i = 0; i < flatImages.length; i += BATCH_SIZE) {
          const batch = flatImages.slice(i, i + BATCH_SIZE);
          console.log(`Inserting images batch ${i/BATCH_SIZE + 1}/${Math.ceil(flatImages.length/BATCH_SIZE)}, size: ${batch.length}`);
          
          const { error: imagesError } = await supabase
            .from('note_images')
            .insert(batch);
            
          if (imagesError) {
            console.error(`Error inserting images batch ${i/BATCH_SIZE + 1}:`, imagesError);
            // Continue with next batch
          }
        }
      }
    }

    // Return project with hierarchical notes and the name actually used in the database
    return {
      id: projectId,
      name: projectInsertResponse.data.title,  // Use the actual saved title
      created_at: projectInsertResponse.data.created_at,
      updated_at: projectInsertResponse.data.updated_at,
      user_id: projectInsertResponse.data.user_id,
      description: projectInsertResponse.data.description || '',
      data: validNotesData
    };
  } catch (error) {
    console.error('Error in createProject:', error);
    return null;
  }
}

export async function updateProject(id: string, name: string, notesData: NotesData, description: string = ''): Promise<Project | null> {
  try {
    console.log('--- updateProject: Starting to update project ---');
    console.log('Project ID:', id);
    console.log('Project name:', name);
    
    // Check if notesData has image information to preserve
    let hasImages = false;
    let totalImages = 0;
    
    if (notesData && notesData.notes) {
      // Traverse notes to count images
      const countImagesInNotes = (notes: Note[]) => {
        for (const note of notes) {
          if (note.images && Array.isArray(note.images) && note.images.length > 0) {
            hasImages = true;
            totalImages += note.images.length;
          }
          
          if (note.children && note.children.length > 0) {
            countImagesInNotes(note.children);
          }
        }
      };
      
      countImagesInNotes(notesData.notes);
    }
    
    console.log(`Notes data contains images: ${hasImages ? 'YES' : 'NO'}, total: ${totalImages}`);
    console.log('Notes data structure:', JSON.stringify({
      noteCount: notesData?.notes?.length || 0,
      hasNotes: !!notesData?.notes?.length,
      imageCount: totalImages,
      sample: notesData?.notes?.length ? notesData.notes[0]?.id : 'no notes'
    }));
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    console.log('Current user ID:', userData.user.id);
    const now = new Date().toISOString();
    
    // Update project in settings table
    console.log('Updating project with notes count:', notesData?.notes?.length || 0);
    
    // Ensure notesData has proper structure
    const validNotesData = notesData && Array.isArray(notesData.notes) 
      ? notesData 
      : { notes: [] };
    
    console.log('Validated notes data for update, count:', validNotesData.notes.length);
    
    // Store the entire project data including images using the server API endpoint
    // This will avoid RLS issues with the projects table
    console.log('Storing full project data with embedded images via API endpoint');
    
    try {
      // Use server API to store project with images
      const response = await fetch('/api/store-project-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: id,
          name: name,
          userId: userData.user.id,
          data: validNotesData,
          description: description
        })
      });
      
      if (!response.ok) {
        console.error('Error storing project data with images via API:', 
          response.status, response.statusText);
        // Continue with regular update anyway
      } else {
        console.log('Successfully stored project data with embedded images via API');
      }
    } catch (storeError) {
      console.error('Exception storing project data with images:', storeError);
      // Continue with regular update anyway
    }
    
    // First update the project name
    console.log('Updating project in settings table...');
    console.log('Updating project with description:', description);
    const { data: projectData, error: projectError } = await supabase
      .from('settings')
      .update({
        title: name,
        description: description,
        updated_at: now,
        last_modified_at: now,
        note_count: validNotesData.notes.length,
        last_level: 0
      })
      .eq('id', id)
      .eq('user_id', userData.user.id) // Ensure user can only update their own projects
      .is('deleted_at', null)
      .select()
      .single();

    if (projectError || !projectData) {
      console.error('Error updating project settings:', projectError);
      return null;
    }
    
    console.log('Project settings successfully updated, now updating notes');
    
    // Now handle notes update - convert hierarchical structure to flat DB records
    // IMPORTANT: We're not going to delete the existing images
    // Deleting images causes compatibility issues with other apps
    // Instead, we'll preserve all image records
    console.log('Skipping image deletion to maintain compatibility with other apps');
    
    // Now delete all existing notes for this project
    console.log('Deleting existing notes for project:', id);
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userData.user.id);
      
    if (deleteError) {
      console.error('Error deleting existing notes:', deleteError);
      return null;
    }
    
    // Add a small delay to ensure deletion is complete before insertion
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Successfully deleted existing notes, now inserting new notes');
    
    // Then create new notes from the hierarchical structure
    const { notes: flatNotes, images: flatImages } = flattenNoteHierarchy(validNotesData.notes, id, userData.user.id);
    console.log('Flattened notes for DB insertion:', flatNotes.length, 'notes', 'and', flatImages.length, 'images');
    
    // Define batch size once
    const BATCH_SIZE = 50;
    
    if (flatNotes.length > 0) {
      console.log('First flattened note sample:', JSON.stringify(flatNotes[0]));
      
      try {
        // We need to make sure we don't have any duplicated IDs in the database
        // The safest approach is to completely recreate the notes with new IDs
        // First, create a mapping from old IDs to new IDs
        const idMapping: Record<string, string> = {};
        
        // Generate new UUIDs for each note
        flatNotes.forEach(note => {
          idMapping[note.id] = crypto.randomUUID();
        });
        
        console.log('Created ID mapping for notes');
        
        // Sort notes by dependency - root notes first, then level by level
        // This helps ensure we don't violate foreign key constraints
        
        // First, create a node map for quick lookups
        const nodeMap: Record<string, any> = {};
        flatNotes.forEach(note => {
          nodeMap[note.id] = note;
        });
        
        // Create lists by level (0 = root, 1 = first level children, etc.)
        const notesByLevel: any[][] = [];
        
        // First pass: identify root nodes (level 0)
        notesByLevel[0] = flatNotes.filter(note => note.parent_id === null);
        
        // Second pass: identify all other levels
        let currentLevel = 0;
        let hasMoreLevels = true;
        
        while (hasMoreLevels) {
          const nextLevelNotes = [];
          const currentLevelIds = notesByLevel[currentLevel].map(note => note.id);
          
          // Find all notes whose parent is in the current level
          for (const note of flatNotes) {
            if (note.parent_id && currentLevelIds.includes(note.parent_id)) {
              nextLevelNotes.push(note);
            }
          }
          
          if (nextLevelNotes.length > 0) {
            currentLevel++;
            notesByLevel[currentLevel] = nextLevelNotes;
          } else {
            hasMoreLevels = false;
          }
        }
        
        console.log(`Organized notes into ${notesByLevel.length} levels`);
        
        // Now insert level by level
        for (let level = 0; level < notesByLevel.length; level++) {
          const levelNotes = notesByLevel[level];
          
          // Skip empty levels
          if (!levelNotes || levelNotes.length === 0) continue;
          
          console.log(`Processing level ${level} with ${levelNotes.length} notes`);
          
          // Process this level's notes with the new IDs and updated parent references
          const processedLevelNotes = levelNotes.map(note => {
            // Get new ID for this note
            const newId = idMapping[note.id];
            
            // If this note has a parent, get the new parent ID from our mapping
            let newParentId = null;
            if (note.parent_id && idMapping[note.parent_id]) {
              newParentId = idMapping[note.parent_id];
            }
            
            return {
              ...note,
              id: newId,
              parent_id: newParentId
            };
          });
          
          // Insert notes for this level in batches
          for (let i = 0; i < processedLevelNotes.length; i += BATCH_SIZE) {
            const batch = processedLevelNotes.slice(i, i + BATCH_SIZE);
            console.log(`Inserting level ${level} batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(processedLevelNotes.length/BATCH_SIZE)}, size: ${batch.length}`);
            
            const { data: insertedData, error: insertError } = await supabase
              .from('notes')
              .insert(batch)
              .select();
              
            if (insertError) {
              console.error(`Error inserting level ${level} batch ${Math.floor(i/BATCH_SIZE) + 1}:`, insertError);
              throw new Error(`Failed to insert notes: ${insertError.message}`);
            } else {
              console.log(`Successfully inserted level ${level} batch ${Math.floor(i/BATCH_SIZE) + 1}, received:`, insertedData?.length || 0, 'records');
            }
          }
        }
      } catch (error) {
        console.error('Error during note insertion:', error);
        return null;
      }
      
      // For now, we'll skip inserting images into Supabase due to RLS issues
      // Instead, we're storing image data directly in the project's data JSON
      // This is already happening because the images are part of the note's data
      console.log('Skipping separate image insertion due to RLS restrictions');
      
      // The images are already included in the notes' data that was stored
      // The server-side API handles the image upload and provides URLs that work locally
    } else {
      console.log('No notes to insert');
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

// Image handling functions
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
    const filePath = `images/${fileName}`;
    
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
    const { data: { publicUrl } } = supabase.storage
      .from('note-images')
      .getPublicUrl(filePath);
    
    console.log('Image uploaded to Supabase, public URL:', publicUrl);
    
    // Use server API for the database part due to RLS policy restrictions
    console.log('Creating database record via server API');
    
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
    
    // Verify the note belongs to the user (optional, RLS should handle this)
    try {
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('user_id')
        .eq('id', imageData.note_id)
        .single();
      
      if (!noteError && noteData && noteData.user_id !== userId) {
        console.error(`User ${userId} attempted to delete an image from note owned by ${noteData.user_id}`);
        return false;
      }
    } catch (verifyError) {
      console.warn('Note verification skipped:', verifyError);
      // Continue with delete - RLS will reject if not authorized
    }
    
    // Delete the file from storage
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
    
    // Verify the note belongs to the user (optional, RLS should handle this)
    try {
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('user_id')
        .eq('id', noteId)
        .single();
      
      if (!noteError && noteData && noteData.user_id !== userId) {
        console.error(`User ${userId} attempted to update an image for note owned by ${noteData.user_id}`);
        return false;
      }
    } catch (verifyError) {
      console.warn('Note verification skipped:', verifyError);
      // Continue - RLS will reject if not authorized
    }
    
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
    
    // First get all note IDs in this project
    const { data: noteIds } = await supabase
      .from('notes')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', userData.user.id);
      
    if (noteIds && noteIds.length > 0) {
      // Delete all images associated with these notes
      const { error: imagesDeleteError } = await supabase
        .from('note_images')
        .delete()
        .in('note_id', noteIds.map(note => note.id));
        
      if (imagesDeleteError) {
        console.error('Error deleting note images:', imagesDeleteError);
        // Continue with note deletion anyway
      }
    }
    
    // Delete all notes for this project 
    const { error: notesDeleteError } = await supabase
      .from('notes')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userData.user.id);
      
    if (notesDeleteError) {
      console.error('Error deleting project notes:', notesDeleteError);
      // Continue with project deletion anyway
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
import { supabase } from './supabase';
import { Note, NotesData } from '../types/notes';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  data: NotesData;
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
export function buildNoteHierarchy(flatNotes: DbNote[]): Note[] {
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
  
  // Create a map to store the hierarchy
  const noteMap = new Map<string, Note>();
  
  // First pass: create Note objects without children
  sortedNotes.forEach(dbNote => {
    // Parse additional properties from _meta if it exists
    let metaData: any = {};
    if (dbNote._meta) {
      try {
        metaData = JSON.parse(dbNote._meta);
      } catch (e) {
        console.error('Error parsing _meta JSON:', e);
      }
    }
    
    // Use the correct position field and ensure it's always a number
    const position = dbNote.note_position !== undefined ? dbNote.note_position : (dbNote.position ?? 0);
    
    // Create Note object with all properties
    noteMap.set(dbNote.id, {
      id: dbNote.id,
      content: dbNote.content,
      position: position,
      // Use meta properties if available, otherwise use direct properties if they exist
      is_discussion: metaData.is_discussion || !!dbNote.is_discussion || false,
      time_set: metaData.time_set || dbNote.time_set || null,
      youtube_url: metaData.youtube_url || dbNote.youtube_url || null,
      url: metaData.url || dbNote.url || null,
      url_display_text: metaData.url_display_text || dbNote.url_display_text || null,
      children: []
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
      children: cleanPositions(note.children)
    }));
  };
  
  return cleanPositions(rootNotes);
}

// Function to flatten hierarchical notes to DB records
export function flattenNoteHierarchy(notes: Note[], projectId: string, userId: string): any[] {
  const flatNotes: any[] = [];
  
  // Recursive function to process each note
  const processNote = (note: Note, parentId: string | null, level: number) => {
    // Create a DB record for this note
    const now = new Date().toISOString();
    
    // Use the correct field names based on the Supabase schema
    const dbNote = {
      id: note.id,
      content: note.content,
      user_id: userId,
      project_id: projectId,
      parent_id: parentId,
      // Use 'position' not 'note_position' as per Supabase schema
      position: note.position, 
      // Store additional properties as JSON in the content field if they don't exist in schema
      // We'll need to parse these out when loading
      _meta: JSON.stringify({
        is_discussion: note.is_discussion || false,
        time_set: note.time_set,
        youtube_url: note.youtube_url,
        url: note.url,
        url_display_text: note.url_display_text
      }),
      created_at: now,
      updated_at: now
    };
    
    // Add to flat list
    flatNotes.push(dbNote);
    
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
  
  return flatNotes;
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
    
    // Convert flat notes to hierarchical structure
    const hierarchicalNotes = notesData ? buildNoteHierarchy(notesData) : [];
    console.log('Hierarchical notes count:', hierarchicalNotes.length);
    
    // Format data for Project interface with notes
    const formattedProject = {
      id: projectData.id,
      name: projectData.title || 'Untitled Project',
      created_at: projectData.created_at,
      updated_at: projectData.updated_at,
      user_id: projectData.user_id,
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
      const flatNotes = flattenNoteHierarchy(validNotesData.notes, projectId, userData.user.id);
      console.log('Flattened notes for DB insertion:', flatNotes.length, 'notes');
      
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
    }

    // Return project with hierarchical notes and the name actually used in the database
    return {
      id: projectId,
      name: projectInsertResponse.data.title,  // Use the actual saved title
      created_at: projectInsertResponse.data.created_at,
      updated_at: projectInsertResponse.data.updated_at,
      user_id: projectInsertResponse.data.user_id,
      data: validNotesData
    };
  } catch (error) {
    console.error('Error in createProject:', error);
    return null;
  }
}

export async function updateProject(id: string, name: string, notesData: NotesData): Promise<Project | null> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    const now = new Date().toISOString();
    
    // Update project in settings table
    console.log('Updating project with notes data:', notesData);
    
    // Ensure notesData has proper structure
    const validNotesData = notesData && Array.isArray(notesData.notes) 
      ? notesData 
      : { notes: [] };
    
    console.log('Validated notes data for update:', validNotesData);
    
    // First update the project name
    console.log('Updating project in settings table...');
    const { data, error } = await supabase
      .from('settings')
      .update({
        title: name,
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

    if (error) {
      console.error('Error updating project:', error);
      return null;
    }
    
    // Now handle notes update - convert hierarchical structure to flat DB records
    // First, delete all existing notes for this project
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userData.user.id);
      
    if (deleteError) {
      console.error('Error deleting existing notes:', deleteError);
      return null;
    }
    
    // Then create new notes from the hierarchical structure
    const flatNotes = flattenNoteHierarchy(validNotesData.notes, id, userData.user.id);
    console.log('Flattened notes for DB insertion:', flatNotes.length, 'notes');
    
    if (flatNotes.length > 0) {
      // Insert notes in batches to avoid payload size limits
      const BATCH_SIZE = 50;
      for (let i = 0; i < flatNotes.length; i += BATCH_SIZE) {
        const batch = flatNotes.slice(i, i + BATCH_SIZE);
        console.log(`Inserting batch ${i/BATCH_SIZE + 1}/${Math.ceil(flatNotes.length/BATCH_SIZE)}, size: ${batch.length}`);
        
        const { error: insertError } = await supabase
          .from('notes')
          .insert(batch);
          
        if (insertError) {
          console.error(`Error inserting notes batch ${i/BATCH_SIZE + 1}:`, insertError);
          // Continue with next batch
        }
      }
    }
    
    // Return updated project with the hierarchical notes
    return {
      id: data.id,
      name: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id,
      data: validNotesData
    };
  } catch (error) {
    console.error('Error in updateProject:', error);
    return null;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    // Delete all notes for this project first
    const { error: notesDeleteError } = await supabase
      .from('notes')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userData.user.id);
      
    if (notesDeleteError) {
      console.error('Error deleting project notes:', notesDeleteError);
      // Continue with project deletion anyway
    }
    
    // Use soft delete (set deleted_at) instead of actual deletion for the project
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
      console.error('Error deleting project:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteProject:', error);
    return false;
  }
}
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
  is_discussion?: boolean;
  created_at: string;
  updated_at: string;
  note_position: number;
  time_set?: string | null;
  youtube_url?: string | null;
  url?: string | null;
  url_display_text?: string | null;
}

// Function to build hierarchical notes from flat DB records
export function buildNoteHierarchy(flatNotes: DbNote[]): Note[] {
  console.log('Building note hierarchy from flat notes:', flatNotes);
  
  // First, sort by position
  const sortedNotes = [...flatNotes].sort((a, b) => a.note_position - b.note_position);
  
  // Create a map to store the hierarchy
  const noteMap = new Map<string, Note>();
  
  // First pass: create Note objects without children
  sortedNotes.forEach(dbNote => {
    noteMap.set(dbNote.id, {
      id: dbNote.id,
      content: dbNote.content,
      position: dbNote.note_position,
      is_discussion: !!dbNote.is_discussion,
      time_set: dbNote.time_set || null,
      youtube_url: dbNote.youtube_url || null,
      url: dbNote.url || null,
      url_display_text: dbNote.url_display_text || null,
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
    const dbNote = {
      id: note.id,
      content: note.content,
      user_id: userId,
      project_id: projectId,
      parent_id: parentId,
      note_position: note.position,
      is_discussion: note.is_discussion || false,
      time_set: note.time_set,
      youtube_url: note.youtube_url,
      url: note.url,
      url_display_text: note.url_display_text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return [];
    }
    
    // Query settings table for projects belonging to the current user
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
      .eq('user_id', userData.user.id)
      .order('note_position', { ascending: true });
    
    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }
    
    console.log('Raw notes data from DB count:', notesData ? notesData.length : 0);
    if (notesData && notesData.length > 0) {
      console.log('First note sample:', notesData[0]);
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
    return formattedProject;
  } catch (error) {
    console.error('Error in getProject:', error);
    return null;
  }
}

export async function createProject(name: string, notesData: NotesData): Promise<Project | null> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    const now = new Date().toISOString();
    
    // Format data for settings table
    console.log('Creating project with notes data:', notesData);
    
    // Ensure notesData has proper structure
    const validNotesData = notesData && Array.isArray(notesData.notes) 
      ? notesData 
      : { notes: [] };
    
    console.log('Validated notes data for storage:', validNotesData);
    
    // Create the project in settings table first
    const { data, error } = await supabase
      .from('settings')
      .insert({
        title: name,
        user_id: userData.user.id,
        created_at: now,
        updated_at: now,
        last_modified_at: now
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return null;
    }
    
    const projectId = data.id;
    
    // If there are notes, create them in the notes table
    if (validNotesData.notes.length > 0) {
      // Convert hierarchical notes to flat DB records
      const flatNotes = flattenNoteHierarchy(validNotesData.notes, projectId, userData.user.id);
      console.log('Flattened notes for DB insertion:', flatNotes);
      
      // Insert notes
      const { error: notesError } = await supabase
        .from('notes')
        .insert(flatNotes);
        
      if (notesError) {
        console.error('Error inserting notes:', notesError);
        // Continue anyway to return the project
      }
    }

    // Return project with hierarchical notes
    return {
      id: projectId,
      name: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id,
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
    const { data, error } = await supabase
      .from('settings')
      .update({
        title: name,
        updated_at: now,
        last_modified_at: now
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
    console.log('Flattened notes for DB insertion:', flatNotes);
    
    if (flatNotes.length > 0) {
      // Insert the flattened notes
      const { error: insertError } = await supabase
        .from('notes')
        .insert(flatNotes);
        
      if (insertError) {
        console.error('Error inserting notes:', insertError);
        // Continue anyway to return the project
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
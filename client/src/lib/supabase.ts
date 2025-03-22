import { createClient } from '@supabase/supabase-js';
import type { Note, NotesData } from '../types/notes';

// Create a single supabase client for interacting with your database
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Notes service functions
export const notesService = {
  // Get all notes for a user
  async getNotes(): Promise<NotesData | null> {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('position');
      
      if (error) {
        console.error('Error fetching notes:', error);
        return null;
      }
      
      // Process the flat data into a tree structure
      const notes = buildNoteTree(data || []);
      return { notes };
    } catch (error) {
      console.error('Error in getNotes:', error);
      return null;
    }
  },
  
  // Save notes (full replace)
  async saveNotes(notesData: NotesData): Promise<boolean> {
    try {
      // First, get all existing notes to determine what to delete
      const { data: existingData, error: fetchError } = await supabase
        .from('notes')
        .select('id');
      
      if (fetchError) {
        console.error('Error fetching existing notes:', fetchError);
        return false;
      }
      
      // Convert hierarchical structure to flat array
      const flatNotes = flattenNoteTree(notesData.notes);
      
      // Find notes to delete (in existing but not in new data)
      const existingIds = new Set((existingData || []).map(note => note.id));
      const newIds = new Set(flatNotes.map(note => note.id));
      
      const idsToDelete = Array.from(existingIds).filter(id => !newIds.has(id as string));
      
      // Begin a transaction
      // 1. Delete notes that no longer exist
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('notes')
          .delete()
          .in('id', idsToDelete);
        
        if (deleteError) {
          console.error('Error deleting notes:', deleteError);
          return false;
        }
      }
      
      // 2. Upsert all the new/updated notes
      const { error: upsertError } = await supabase
        .from('notes')
        .upsert(flatNotes, { onConflict: 'id' });
      
      if (upsertError) {
        console.error('Error upserting notes:', upsertError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in saveNotes:', error);
      return false;
    }
  },
  
  // Save a single note
  async saveNote(note: Note): Promise<boolean> {
    try {
      // Prepare a flat version of the note without children
      const { children, ...noteWithoutChildren } = note;
      
      const { error } = await supabase
        .from('notes')
        .upsert(noteWithoutChildren, { onConflict: 'id' });
      
      if (error) {
        console.error('Error saving note:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in saveNote:', error);
      return false;
    }
  },
  
  // Delete a note and its children
  async deleteNote(noteId: string): Promise<boolean> {
    try {
      // Get all notes to find children
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*');
      
      if (fetchError) {
        console.error('Error fetching notes for deletion:', fetchError);
        return false;
      }
      
      // Build a tree to identify all descendant notes
      const allNotes = data || [];
      const idsToDelete = getDescendantIds(allNotes, noteId);
      idsToDelete.push(noteId); // Add the parent note itself
      
      // Delete all identified notes
      const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) {
        console.error('Error deleting notes:', deleteError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteNote:', error);
      return false;
    }
  }
};

// Helper function to build a hierarchical tree from flat data
function buildNoteTree(flatNotes: any[]): Note[] {
  const noteMap = new Map<string, Note>();
  const rootNotes: Note[] = [];
  
  // First pass: create all note objects and store in map
  flatNotes.forEach(flatNote => {
    const note: Note = {
      id: flatNote.id,
      content: flatNote.content || '',
      position: flatNote.position || 0,
      is_discussion: flatNote.is_discussion || false,
      time_set: flatNote.time_set || null,
      youtube_url: flatNote.youtube_url || null,
      url: flatNote.url || null,
      url_display_text: flatNote.url_display_text || null,
      children: []
    };
    
    noteMap.set(note.id, note);
  });
  
  // Second pass: build the tree structure
  flatNotes.forEach(flatNote => {
    const note = noteMap.get(flatNote.id);
    if (!note) return;
    
    const parentId = flatNote.parent_id;
    
    if (parentId && noteMap.has(parentId)) {
      // Add to parent's children
      const parent = noteMap.get(parentId);
      parent?.children.push(note);
    } else {
      // This is a root note
      rootNotes.push(note);
    }
  });
  
  // Sort children arrays by position
  noteMap.forEach(note => {
    note.children.sort((a, b) => a.position - b.position);
  });
  
  // Sort root notes by position
  rootNotes.sort((a, b) => a.position - b.position);
  
  return rootNotes;
}

// Helper function to flatten a note tree into an array
function flattenNoteTree(notes: Note[]): any[] {
  const result: any[] = [];
  
  function processNote(note: Note, parentId: string | null = null) {
    // Create a flat note object without the children property
    const { children, ...noteWithoutChildren } = note;
    
    // Add the parent_id property for database relations
    const flatNote = {
      ...noteWithoutChildren,
      parent_id: parentId
    };
    
    result.push(flatNote);
    
    // Process all children with this note as parent
    if (children && children.length > 0) {
      children.forEach(child => processNote(child, note.id));
    }
  }
  
  notes.forEach(note => processNote(note));
  return result;
}

// Helper function to get all descendant IDs for deletion
function getDescendantIds(flatNotes: any[], parentId: string): string[] {
  const childIds: string[] = [];
  
  // Find immediate children
  const children = flatNotes.filter(note => note.parent_id === parentId);
  
  // For each child, recursively get its descendants
  children.forEach(child => {
    childIds.push(child.id);
    const descendantIds = getDescendantIds(flatNotes, child.id);
    childIds.push(...descendantIds);
  });
  
  return childIds;
}
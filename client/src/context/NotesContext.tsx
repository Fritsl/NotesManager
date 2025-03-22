import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Note, NotesData } from "@/types/notes";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";

interface NotesContextType {
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  selectedNote: Note | null;
  selectNote: (note: Note | null) => void;
  breadcrumbs: Note[];
  addNote: (parent: Note | null) => void;
  updateNote: (updatedNote: Note) => void;
  deleteNote: (noteId: string) => void;
  moveNote: (noteId: string, targetParentId: string | null, position: number) => void;
  importNotes: (data: NotesData) => void;
  exportNotes: () => NotesData;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Note[]>([]);
  const { toast } = useToast();

  // Import notes from JSON
  const importNotes = useCallback((data: NotesData) => {
    if (data && Array.isArray(data.notes)) {
      setNotes(data.notes);
      setSelectedNote(null);
      setBreadcrumbs([]);
      toast({
        title: "Import Successful",
        description: `Imported ${data.notes.length} notes`,
      });
    } else {
      toast({
        title: "Import Failed",
        description: "Invalid notes data format",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Export notes to JSON
  const exportNotes = useCallback((): NotesData => {
    return { notes };
  }, [notes]);

  // Find a note and its path by ID
  const findNoteAndPath = useCallback((
    noteId: string,
    currentNodes: Note[] = notes,
    path: Note[] = []
  ): { note: Note | null; path: Note[] } => {
    for (const note of currentNodes) {
      if (note.id === noteId) {
        return { note, path };
      }
      
      if (note.children.length > 0) {
        const result = findNoteAndPath(noteId, note.children, [...path, note]);
        if (result.note) {
          return result;
        }
      }
    }
    
    return { note: null, path: [] };
  }, [notes]);

  // Select a note and update breadcrumbs
  const selectNote = useCallback((note: Note | null) => {
    if (!note) {
      setSelectedNote(null);
      setBreadcrumbs([]);
      return;
    }
    
    const { path } = findNoteAndPath(note.id);
    setSelectedNote(note);
    setBreadcrumbs(path);
  }, [findNoteAndPath]);

  // Find a note and its parent
  const findNoteAndParent = useCallback((
    noteId: string,
    currentNodes: Note[] = notes,
    parent: Note | null = null
  ): { note: Note | null; parent: Note | null; index: number } => {
    for (let i = 0; i < currentNodes.length; i++) {
      if (currentNodes[i].id === noteId) {
        return { note: currentNodes[i], parent, index: i };
      }
      
      if (currentNodes[i].children.length > 0) {
        const result = findNoteAndParent(noteId, currentNodes[i].children, currentNodes[i]);
        if (result.note) {
          return result;
        }
      }
    }
    
    return { note: null, parent: null, index: -1 };
  }, [notes]);

  // Add a new note
  const addNote = useCallback((parent: Note | null) => {
    const newNote: Note = {
      id: uuidv4(),
      content: "New note",
      position: 0,
      is_discussion: false,
      time_set: null,
      youtube_url: null,
      url: null,
      url_display_text: null,
      children: [],
    };

    if (!parent) {
      // Add as root note
      setNotes((prevNotes) => {
        const updatedNotes = [...prevNotes];
        newNote.position = updatedNotes.length;
        updatedNotes.push(newNote);
        return updatedNotes;
      });
    } else {
      // Add as child
      setNotes((prevNotes) => {
        const updatedNotes = [...prevNotes];
        const { note: foundParent } = findNoteAndPath(parent.id, updatedNotes);
        
        if (foundParent) {
          newNote.position = foundParent.children.length;
          foundParent.children.push(newNote);
        }
        
        return updatedNotes;
      });
    }

    selectNote(newNote);
    toast({
      title: "Note Added",
      description: "A new note has been added",
    });
  }, [findNoteAndPath, selectNote, toast]);

  // Update a note
  const updateNote = useCallback((updatedNote: Note) => {
    setNotes((prevNotes) => {
      const updatedNotes = [...prevNotes];
      
      // Find the note at any level in the tree
      const updateNoteInTree = (nodes: Note[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === updatedNote.id) {
            // Preserve children reference if not provided
            if (!updatedNote.children || updatedNote.children.length === 0) {
              updatedNote.children = nodes[i].children;
            }
            nodes[i] = { ...updatedNote };
            return true;
          }
          
          if (nodes[i].children.length > 0) {
            if (updateNoteInTree(nodes[i].children)) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      updateNoteInTree(updatedNotes);
      return updatedNotes;
    });
    
    setSelectedNote(updatedNote);
    toast({
      title: "Note Updated",
      description: "Your changes have been saved",
    });
  }, [toast]);

  // Delete a note
  const deleteNote = useCallback((noteId: string) => {
    setNotes((prevNotes) => {
      const updatedNotes = [...prevNotes];
      
      // Find and remove the note at any level in the tree
      const removeNoteFromTree = (nodes: Note[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === noteId) {
            nodes.splice(i, 1);
            return true;
          }
          
          if (nodes[i].children.length > 0) {
            if (removeNoteFromTree(nodes[i].children)) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      removeNoteFromTree(updatedNotes);
      return updatedNotes;
    });
    
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setBreadcrumbs([]);
    }
    
    toast({
      title: "Note Deleted",
      description: "The note has been removed",
    });
  }, [selectedNote, toast]);

  // Move a note in the tree
  const moveNote = useCallback((noteId: string, targetParentId: string | null, position: number) => {
    setNotes((prevNotes) => {
      const updatedNotes = [...prevNotes];
      
      // Find the note to move and its current parent
      const { note: noteToMove, parent: sourceParent, index: sourceIndex } = findNoteAndParent(noteId, updatedNotes);
      
      if (!noteToMove) return updatedNotes;
      
      // Remove note from its current position
      if (sourceParent) {
        sourceParent.children.splice(sourceIndex, 1);
      } else {
        updatedNotes.splice(sourceIndex, 1);
      }
      
      // Add the note to its new position
      if (targetParentId === null) {
        // Move to root level
        const insertPosition = Math.min(position, updatedNotes.length);
        updatedNotes.splice(insertPosition, 0, noteToMove);
        
        // Update positions
        updatedNotes.forEach((note, index) => {
          note.position = index;
        });
      } else {
        // Find target parent and insert the note as a child
        const findAndInsert = (nodes: Note[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === targetParentId) {
              const insertPosition = Math.min(position, nodes[i].children.length);
              nodes[i].children.splice(insertPosition, 0, noteToMove);
              
              // Update positions
              nodes[i].children.forEach((child, index) => {
                child.position = index;
              });
              
              return true;
            }
            
            if (nodes[i].children.length > 0) {
              if (findAndInsert(nodes[i].children)) {
                return true;
              }
            }
          }
          
          return false;
        };
        
        findAndInsert(updatedNotes);
      }
      
      return updatedNotes;
    });
    
    toast({
      title: "Note Moved",
      description: "The note has been moved to a new position",
    });
  }, [findNoteAndParent, toast]);

  return (
    <NotesContext.Provider
      value={{
        notes,
        setNotes,
        selectedNote,
        selectNote,
        breadcrumbs,
        addNote,
        updateNote,
        deleteNote,
        moveNote,
        importNotes,
        exportNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error("useNotes must be used within a NotesProvider");
  }
  return context;
}

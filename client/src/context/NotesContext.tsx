import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";
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
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (noteId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandToLevel: (level: number) => void;
  currentLevel: number;
  maxDepth: number;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Note[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [currentLevel, setCurrentLevel] = useState<number>(1);
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

  // Toggle expansion for a single node
  const toggleExpand = useCallback((noteId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  }, []);

  // Get all note IDs in the tree
  const getAllNoteIds = useCallback((notesArray: Note[]): string[] => {
    let ids: string[] = [];
    notesArray.forEach(note => {
      ids.push(note.id);
      if (note.children.length > 0) {
        ids = [...ids, ...getAllNoteIds(note.children)];
      }
    });
    return ids;
  }, []);

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allIds = getAllNoteIds(notes);
    setExpandedNodes(new Set(allIds));
    setCurrentLevel(5); // Set to a high level to indicate full expansion
  }, [getAllNoteIds, notes]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
    setCurrentLevel(0);
  }, []);

  // Helper function to get nodes at a specific level
  const getNoteIdsByLevel = useCallback((
    notesArray: Note[], 
    maxLevel: number, 
    currentLevel = 0, 
    exactLevel = false
  ): string[] => {
    let ids: string[] = [];
    
    notesArray.forEach(note => {
      // If we're collecting notes up to a specific level
      if (!exactLevel && currentLevel <= maxLevel) {
        ids.push(note.id);
      }
      
      // If we're collecting notes at an exact level
      if (exactLevel && currentLevel === maxLevel) {
        ids.push(note.id);
      }
      
      // If the note has children, recursively collect their IDs
      if (note.children.length > 0 && currentLevel < maxLevel) {
        ids = [...ids, ...getNoteIdsByLevel(
          note.children, 
          maxLevel, 
          currentLevel + 1, 
          exactLevel
        )];
      }
    });
    
    return ids;
  }, []);

  // Calculate the maximum depth of notes in the tree
  const calculateMaxDepth = useCallback((notesArray: Note[], currentDepth = 0): number => {
    if (notesArray.length === 0) {
      return currentDepth;
    }
    
    let maxChildDepth = currentDepth;
    
    notesArray.forEach(note => {
      if (note.children.length > 0) {
        const childDepth = calculateMaxDepth(note.children, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    });
    
    return maxChildDepth;
  }, []);
  
  // Get the maximum depth of the notes tree (limit to 9)
  const maxDepth = useMemo(() => {
    const depth = calculateMaxDepth(notes);
    return Math.min(Math.max(depth + 1, 1), 9); // +1 because depth is 0-based, limit to max 9
  }, [notes, calculateMaxDepth]);

  // Expand to a specific level
  const expandToLevel = useCallback((level: number) => {
    // Ensure level is at least 0
    const targetLevel = Math.max(0, level);
    
    if (targetLevel === 0) {
      // Level 0 means collapse all
      setExpandedNodes(new Set());
      setCurrentLevel(0);
      return;
    }
    
    // Function to collect node IDs that need to be expanded to show up to the target level
    const collectNodesForLevel = (
      notesArray: Note[], 
      currentDepth = 0, 
      maxDepth: number,
      parentIds: string[] = []
    ): string[] => {
      // If we've reached the maximum depth we want to show, stop expanding
      if (currentDepth >= maxDepth) {
        return [];
      }
      
      let idsToExpand: string[] = [];
      
      notesArray.forEach(note => {
        // If this node has children and we're not at the target depth yet,
        // we need to expand this node
        if (note.children.length > 0 && currentDepth < maxDepth) {
          idsToExpand.push(note.id);
          
          // Recursively collect IDs from children
          const childIds = collectNodesForLevel(
            note.children,
            currentDepth + 1,
            maxDepth,
            [...parentIds, note.id]
          );
          
          idsToExpand = [...idsToExpand, ...childIds];
        }
      });
      
      return idsToExpand;
    };
    
    // Collect IDs to expand (all nodes up to the level before target level)
    const idsToExpand = collectNodesForLevel(notes, 0, targetLevel - 1);
    
    // Update the current level
    setCurrentLevel(targetLevel);
    
    // Update expanded nodes
    setExpandedNodes(new Set(idsToExpand));
  }, [notes]);

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
        expandedNodes,
        setExpandedNodes,
        toggleExpand,
        expandAll,
        collapseAll,
        expandToLevel,
        currentLevel,
        maxDepth,
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

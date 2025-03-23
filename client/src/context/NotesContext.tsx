import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useRef } from "react";
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

  // Clean note positions to ensure sequential ordering without gaps
  const cleanNotePositions = useCallback((noteList: Note[]): Note[] => {
    // Sort the notes by their current position
    const sortedNotes = [...noteList].sort((a, b) => a.position - b.position);
    
    // Reassign positions sequentially starting from 0
    const cleanedNotes = sortedNotes.map((note, index) => ({
      ...note,
      position: index,
      // Recursively clean child positions
      children: note.children.length > 0 ? cleanNotePositions(note.children) : []
    }));
    
    return cleanedNotes;
  }, []);

  // Import notes from JSON
  const importNotes = useCallback((data: NotesData) => {
    if (data && Array.isArray(data.notes)) {
      // Clean up the positions before setting the notes
      const cleanedNotes = cleanNotePositions(data.notes);
      setNotes(cleanedNotes);
      setSelectedNote(null);
      setBreadcrumbs([]);
      toast({
        title: "Import Successful",
        description: `Imported ${data.notes.length} notes with cleaned positions`,
      });
    } else {
      toast({
        title: "Import Failed",
        description: "Invalid notes data format",
        variant: "destructive",
      });
    }
  }, [toast, cleanNotePositions]);

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
        
        // Clean positions at root level to ensure consistency
        return cleanNotePositions(updatedNotes);
      });
    } else {
      // Add as child
      setNotes((prevNotes) => {
        const updatedNotes = [...prevNotes];
        const { note: foundParent } = findNoteAndPath(parent.id, updatedNotes);
        
        if (foundParent) {
          newNote.position = foundParent.children.length;
          foundParent.children.push(newNote);
          
          // Clean positions for this parent's children
          foundParent.children = cleanNotePositions(foundParent.children);
        }
        
        return updatedNotes;
      });
    }

    selectNote(newNote);
    toast({
      title: "Note Added",
      description: "A new note has been added",
    });
  }, [findNoteAndPath, selectNote, cleanNotePositions, toast]);

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
      let parentWithUpdatedChildren: Note | null = null;
      
      // Find and remove the note at any level in the tree
      const removeNoteFromTree = (nodes: Note[], parent: Note | null = null): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === noteId) {
            nodes.splice(i, 1);
            // Keep track of parent that had a child removed
            parentWithUpdatedChildren = parent;
            return true;
          }
          
          if (nodes[i].children.length > 0) {
            if (removeNoteFromTree(nodes[i].children, nodes[i])) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      removeNoteFromTree(updatedNotes);
      
      // If we deleted from a parent's children, clean those children's positions
      if (parentWithUpdatedChildren) {
        parentWithUpdatedChildren.children = parentWithUpdatedChildren.children.map((child, index) => ({
          ...child,
          position: index
        }));
      } else {
        // If we deleted from root level, clean root positions
        updatedNotes.forEach((note, index) => {
          note.position = index;
        });
      }
      
      // Apply full position cleaning to ensure consistency
      return cleanNotePositions(updatedNotes);
    });
    
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setBreadcrumbs([]);
    }
    
    toast({
      title: "Note Deleted",
      description: "The note has been removed",
    });
  }, [selectedNote, cleanNotePositions, toast]);

  // Reference to track if a move operation is in progress to prevent multiple simultaneous moves
  const isMovingRef = useRef<boolean>(false);
  
  // Move a note in the tree
  const moveNote = useCallback((noteId: string, targetParentId: string | null, position: number) => {
    // Prevent multiple drop handlers from triggering simultaneously
    if (isMovingRef.current) {
      console.log("⚠️ Ignoring duplicate move operation - operation already in progress");
      return;
    }
    
    // Set the moving flag to true
    isMovingRef.current = true;
    
    // Create a timeout to reset the flag after a short delay
    setTimeout(() => {
      isMovingRef.current = false;
    }, 200); // 200ms should be enough to block duplicate events
    
    console.log(`📌 MOVING note ${noteId} to parent: ${targetParentId}, position: ${position}`);
    
    setNotes((prevNotes) => {
      const updatedNotes = [...prevNotes];
      
      // Find the note to move and its current parent
      const { note: foundNote, parent: sourceParent, index: sourceIndex } = findNoteAndParent(noteId, updatedNotes);
      
      if (!foundNote) {
        console.error("Note not found:", noteId);
        return updatedNotes;
      }
      
      // Create a deep copy of the note to move (to avoid reference issues)
      const noteToMove = JSON.parse(JSON.stringify(foundNote));
      
      // Check if trying to move a note to one of its own descendants (which would create a cycle)
      const isTargetADescendantOfSource = (sourceId: string, targetParentId: string | null): boolean => {
        if (targetParentId === null) return false;
        if (sourceId === targetParentId) return true;
        
        // Helper function to check if targetId is a descendant of any node
        const isDescendant = (nodes: Note[], targetId: string): boolean => {
          for (const node of nodes) {
            if (node.id === targetId) {
              return true;
            }
            
            if (node.children.length > 0 && isDescendant(node.children, targetId)) {
              return true;
            }
          }
          return false;
        };
        
        // Check if targetParentId is a descendant of the source note
        return isDescendant(foundNote.children, targetParentId);
      };
      
      if (targetParentId && isTargetADescendantOfSource(noteId, targetParentId)) {
        console.warn("Cannot move a note to one of its own descendants");
        return updatedNotes;
      }
      
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
        
        // Clean all positions at root level
        updatedNotes.forEach((note, index) => {
          note.position = index;
        });
      } else {
        // Find target parent and insert the note as a child
        const findAndInsert = (nodes: Note[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === targetParentId) {
              console.log(`INSERTING note ${noteToMove.id} as child of ${targetParentId} at position ${position}`);
              
              // Make sure we have a valid position (defensive)
              const insertPosition = Math.min(position, nodes[i].children.length);
              
              // Important: Deep clone the note to avoid reference issues
              const noteClone = JSON.parse(JSON.stringify(noteToMove));
              
              // Insert at the specified position
              nodes[i].children.splice(insertPosition, 0, noteClone);
              
              // Clean all positions in this child list
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
      
      // For complex moves that might affect multiple levels, 
      // use the full cleanNotePositions function to ensure consistency
      return cleanNotePositions(updatedNotes);
    });
    
    toast({
      title: "Note Moved",
      description: "The note has been moved to a new position",
    });
  }, [findNoteAndParent, cleanNotePositions, toast]);

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
    
    // Helper function to collect IDs at or above a specific level
    const getParentIds = (notesArray: Note[], depth = 1): string[] => {
      let ids: string[] = [];
      
      // We only expand nodes at levels LESS than the target level 
      // (so nodes at levels 0 to targetLevel-1)
      // This will show content at level 0 through targetLevel
      if (depth >= targetLevel) {
        return ids;
      }
      
      for (const note of notesArray) {
        if (note.children.length > 0) {
          // Include this node's ID if it has children and we're not at max level
          ids.push(note.id);
          
          // Recursively process children at next depth level
          const childIds = getParentIds(note.children, depth + 1);
          ids = [...ids, ...childIds];
        }
      }
      
      return ids;
    };

    // Get all parent node IDs up to one level before target level
    const idsToExpand = getParentIds(notes);
    
    // Update the current level indicator
    setCurrentLevel(targetLevel);
    
    // Update expanded nodes set
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

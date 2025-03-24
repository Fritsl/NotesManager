import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useRef, useEffect } from "react";
import { Note, NotesData, NoteImage } from "@/types/notes";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { 
  createProject, 
  updateProject, 
  addImageToNote, 
  removeImageFromNote, 
  updateImagePosition 
} from "@/lib/projectService";

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
  importNotes: (data: NotesData, projectName?: string, projectId?: string | null) => void;
  exportNotes: () => NotesData;
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (noteId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandToLevel: (level: number) => void;
  currentLevel: number;
  maxDepth: number;
  currentProjectName: string;
  setCurrentProjectName: (name: string) => void;
  hasActiveProject: boolean;
  setHasActiveProject: (hasProject: boolean) => void;
  createNewProject: (name: string) => void;
  saveProject: () => Promise<void>;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  debugInfo: () => any; // For debugging purposes
  
  // Image handling functions
  uploadImage: (noteId: string, file: File) => Promise<NoteImage | null>;
  removeImage: (imageId: string) => Promise<boolean>;
  reorderImage: (noteId: string, imageId: string, newPosition: number) => Promise<boolean>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Note[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [hasActiveProject, setHasActiveProject] = useState<boolean>(false);
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
      children: note.children.length > 0 ? cleanNotePositions(note.children) : [],
      // Preserve images array
      images: note.images || []
    }));
    
    return cleanedNotes;
  }, []);

  // Import notes from JSON
  const importNotes = useCallback((data: NotesData, projectName?: string, projectId?: string | null) => {
    console.log('ImportNotes received data:', data);
    console.log('Project name:', projectName);
    console.log('Project ID:', projectId);
    
    if (!data) {
      console.error('ImportNotes failed: data is null or undefined');
      toast({
        title: "Import Failed",
        description: "No data provided for import",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.notes) {
      console.error('ImportNotes failed: data.notes is missing', data);
      toast({
        title: "Import Failed",
        description: "Invalid notes data format: missing notes array",
        variant: "destructive",
      });
      return;
    }
    
    if (!Array.isArray(data.notes)) {
      console.error('ImportNotes failed: data.notes is not an array', typeof data.notes, data);
      toast({
        title: "Import Failed",
        description: "Invalid notes data format: notes is not an array",
        variant: "destructive",
      });
      return;
    }
    
    // Clean up the positions before setting the notes
    console.log('Cleaning note positions for', data.notes.length, 'notes');
    const cleanedNotes = cleanNotePositions(data.notes);
    console.log('Cleaned notes:', cleanedNotes);
    
    setNotes(cleanedNotes);
    setSelectedNote(null);
    setBreadcrumbs([]);
    
    // Update project name if provided
    if (projectName) {
      setCurrentProjectName(projectName);
    }
    
    // Set current project ID if provided, otherwise set to null
    // This ensures local imports don't have a projectId but database loads do
    setCurrentProjectId(projectId || null);
    
    // Always set hasActiveProject to true when importing notes
    setHasActiveProject(true);
    
    toast({
      title: "Import Successful",
      description: `Imported ${data.notes.length} notes${projectName ? ` from "${projectName}"` : ''}`,
    });
  }, [toast, cleanNotePositions]);

  // Export notes to JSON
  const exportNotes = useCallback((): NotesData => {
    // Clone notes and deduplicate images in each note
    const dedupedNotes = JSON.parse(JSON.stringify(notes)).map((note: any) => {
      // Process this note and its children recursively
      const processNote = (noteToProcess: any): any => {
        // Deduplicate images if they exist
        if (noteToProcess.images && Array.isArray(noteToProcess.images) && noteToProcess.images.length > 0) {
          // Use a Map with image ID as key to eliminate duplicates
          noteToProcess.images = Array.from(
            new Map(
              noteToProcess.images.map((img: any) => [img.id, img])
            ).values()
          );
          // Sort by position after deduplication
          noteToProcess.images.sort((a: any, b: any) => a.position - b.position);
        }
        
        // Process children recursively
        if (noteToProcess.children && Array.isArray(noteToProcess.children)) {
          noteToProcess.children = noteToProcess.children.map(processNote);
        }
        
        return noteToProcess;
      };
      
      return processNote(note);
    });
    
    return { notes: dedupedNotes };
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
      images: [], // Initialize with empty images array
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
    // Log the updated note to help with debugging
    console.log('Updating note:', {
      id: updatedNote.id,
      content: updatedNote.content,
      contentLength: updatedNote.content ? updatedNote.content.length : 0
    });
    
    // Ensure content is a string
    if (typeof updatedNote.content !== 'string') {
      console.warn('Note content is not a string, converting to string:', updatedNote.id);
      updatedNote.content = String(updatedNote.content || '');
    }
    
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
            
            // Preserve images reference if not provided
            if (!updatedNote.images || !Array.isArray(updatedNote.images)) {
              updatedNote.images = nodes[i].images || [];
            }
            
            // Create a copy of the updated note
            const updatedNoteCopy = { ...updatedNote };
            
            // Assign to the nodes array
            nodes[i] = updatedNoteCopy;
            
            console.log('Note updated in tree, new content:', nodes[i].content);
            return true;
          }
          
          if (nodes[i].children && nodes[i].children.length > 0) {
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
    
    // Make a copy of the note to avoid reference issues
    const updatedNoteCopy = { ...updatedNote };
    
    // Update the selected note state
    setSelectedNote(updatedNoteCopy);
    
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
      if (parentWithUpdatedChildren && parentWithUpdatedChildren.children) {
        parentWithUpdatedChildren.children = parentWithUpdatedChildren.children.map((child: Note, index: number) => ({
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
      if (note.children && note.children.length > 0) {
        ids = [...ids, ...getAllNoteIds(note.children)];
      }
    });
    return ids;
  }, []);

  // Expand all nodes in the tree
  const expandAll = useCallback(() => {
    const allIds = getAllNoteIds(notes);
    setExpandedNodes(new Set(allIds));
  }, [notes, getAllNoteIds]);

  // Collapse all nodes in the tree
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Calculate the maximum depth of the tree
  const calculateMaxDepth = useCallback((notesArray: Note[], currentDepth = 0): number => {
    if (!notesArray || notesArray.length === 0) {
      return currentDepth;
    }

    let maxChildDepth = currentDepth;
    for (const note of notesArray) {
      if (note.children && note.children.length > 0) {
        const childDepth = calculateMaxDepth(note.children, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }

    return maxChildDepth;
  }, []);

  // Calculate the depth of the tree (memoized)
  const maxDepth = useMemo(() => {
    return calculateMaxDepth(notes);
  }, [notes, calculateMaxDepth]);

  // Expand nodes up to a certain level
  const expandToLevel = useCallback((level: number) => {
    console.log(`Expanding to level: ${level}`);
    
    // Always reset expanded nodes first
    setExpandedNodes(new Set());
    
    if (level <= 0) {
      // Level 0 means collapse all
      setCurrentLevel(0);
      return;
    }
    
    const newExpandedNodes = new Set<string>();
    
    // Helper function to traverse the tree and expand nodes up to the specified level
    const expandLevels = (nodes: Note[], currentLevel = 0) => {
      // If we're at a level that's too deep, stop recursion
      if (currentLevel >= level) {
        return;
      }
      
      for (const note of nodes) {
        // Add this node to expanded set if it has children
        // and we haven't reached the target level yet
        if (note.children && note.children.length > 0) {
          newExpandedNodes.add(note.id);
          
          // Recursively process children to the next level
          expandLevels(note.children, currentLevel + 1);
        }
      }
    };
    
    expandLevels(notes);
    setExpandedNodes(newExpandedNodes);
    setCurrentLevel(level);
    console.log(`Expanded nodes count: ${newExpandedNodes.size}, current level set to: ${level}`);
  }, [notes]);

  // Create a new project
  const createNewProject = useCallback(async (name: string) => {
    try {
      if (!name) {
        toast({
          title: "Error",
          description: "Project name cannot be empty",
          variant: "destructive",
        });
        return;
      }
      
      // Create an empty notes array for the new project
      const emptyNotesData: NotesData = { notes: [] };
      
      // Create the project in the database
      console.log('Creating new project:', name);
      const createdProject = await createProject(name, emptyNotesData);
      
      if (!createdProject) {
        console.error('Failed to create project');
        toast({
          title: "Error Creating Project",
          description: "Could not create the project. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Project created:', createdProject);
      
      // Set the current project
      setCurrentProjectId(createdProject.id);
      setCurrentProjectName(createdProject.name);
      setHasActiveProject(true);
      
      // Clear previous notes
      setNotes([]);
      setSelectedNote(null);
      setBreadcrumbs([]);
      
      toast({
        title: "Project Created",
        description: `New project "${name}" has been created`,
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error Creating Project",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  }, [toast, setCurrentProjectId, setCurrentProjectName]);

  // Save the current project
  const saveProject = useCallback(async () => {
    try {
      if (!currentProjectId) {
        console.warn('Cannot save: No current project ID');
        toast({
          title: "Cannot Save",
          description: "No active project. Create or load a project first.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Saving project:', { 
        id: currentProjectId, 
        name: currentProjectName,
        notesCount: notes.length,
        firstNote: notes.length > 0 ? notes[0].content : 'No notes'
      });
      
      // Make a deep copy of the notes to avoid mutation issues
      const notesCopy = JSON.parse(JSON.stringify(notes));
      
      // Process notes to clean positions and deduplicate images
      const processedNotes = cleanNotePositions(notesCopy).map((note: Note) => {
        // Process this note and its children recursively to deduplicate images
        const processNote = (noteToProcess: Note): Note => {
          // Ensure note content is a string
          if (typeof noteToProcess.content !== 'string') {
            console.warn(`Note ${noteToProcess.id} has non-string content, converting to string`);
            noteToProcess.content = String(noteToProcess.content || '');
          }
          
          // Deduplicate images if they exist
          if (noteToProcess.images && Array.isArray(noteToProcess.images) && noteToProcess.images.length > 0) {
            // Use a Map with image ID as key to eliminate duplicates
            noteToProcess.images = Array.from(
              new Map(
                noteToProcess.images.map((img) => [img.id, img])
              ).values()
            );
            // Sort by position after deduplication
            noteToProcess.images.sort((a, b) => a.position - b.position);
          }
          
          // Process children recursively
          if (noteToProcess.children && Array.isArray(noteToProcess.children)) {
            noteToProcess.children = noteToProcess.children.map(processNote);
          }
          
          return noteToProcess;
        };
        
        return processNote(note);
      });
      
      // Log first note to verify content is being saved properly
      if (processedNotes.length > 0) {
        console.log('First note being saved:', {
          id: processedNotes[0].id,
          content: processedNotes[0].content,
          contentLength: processedNotes[0].content.length
        });
      }
      
      // Create a clean copy of the notes data to save
      const notesData: NotesData = { notes: processedNotes };
      
      // Update the project in the database
      const updatedProject = await updateProject(currentProjectId, currentProjectName, notesData);
      
      if (!updatedProject) {
        console.error('Failed to update project');
        toast({
          title: "Error Saving Project",
          description: "Could not save the project. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Project saved successfully:', updatedProject);
      
      toast({
        title: "Project Saved",
        description: `"${currentProjectName}" has been saved`,
      });
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: "Error Saving Project",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  }, [currentProjectId, currentProjectName, notes, cleanNotePositions, toast]);

  // Image handling functions
  // Upload an image to a note
  const uploadImage = useCallback(async (noteId: string, file: File): Promise<NoteImage | null> => {
    if (!currentProjectId) {
      toast({
        title: "Upload Failed",
        description: "You need to create or load a project before adding images",
        variant: "destructive",
      });
      return null;
    }

    try {
      const imageData = await addImageToNote(noteId, file);
      
      if (!imageData) {
        toast({
          title: "Upload Failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
        return null;
      }
      
      // Update the note with the new image
      setNotes(prevNotes => {
        const updatedNotes = [...prevNotes];
        
        // Find the note to update
        const updateNoteImages = (nodes: Note[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === noteId) {
              // Initialize images array if it doesn't exist
              if (!nodes[i].images) {
                nodes[i].images = [];
              }
              
              // Add the new image to the images array
              nodes[i].images.push(imageData);
              return true;
            }
            
            if (nodes[i].children.length > 0) {
              if (updateNoteImages(nodes[i].children)) {
                return true;
              }
            }
          }
          
          return false;
        };
        
        updateNoteImages(updatedNotes);
        return updatedNotes;
      });
      
      // Update selected note if it's the note we added an image to
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(prevSelected => {
          if (!prevSelected) return null;
          
          const updatedSelected = { ...prevSelected };
          if (!updatedSelected.images) {
            updatedSelected.images = [];
          }
          updatedSelected.images.push(imageData);
          return updatedSelected;
        });
      }
      
      toast({
        title: "Image Uploaded",
        description: "Image has been added to the note",
      });
      
      return imageData;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Failed",
        description: "An error occurred while uploading the image",
        variant: "destructive",
      });
      return null;
    }
  }, [currentProjectId, selectedNote, toast]);

  // Remove an image from a note
  const removeImage = useCallback(async (imageId: string): Promise<boolean> => {
    if (!currentProjectId) {
      toast({
        title: "Operation Failed",
        description: "You need to have an active project to remove images",
        variant: "destructive",
      });
      return false;
    }

    try {
      const success = await removeImageFromNote(imageId);
      
      if (!success) {
        toast({
          title: "Removal Failed",
          description: "Failed to remove image. Please try again.",
          variant: "destructive",
        });
        return false;
      }
      
      // Update the notes state to remove the image
      setNotes(prevNotes => {
        const updatedNotes = [...prevNotes];
        
        // Function to find and remove the image from a note
        const removeImageFromNote = (nodes: Note[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            // Check if this note has the image
            if (nodes[i].images && nodes[i].images.length > 0) {
              const imageIndex = nodes[i].images.findIndex(img => img.id === imageId);
              if (imageIndex !== -1) {
                // Remove the image from the array
                nodes[i].images.splice(imageIndex, 1);
                return true;
              }
            }
            
            // Check children
            if (nodes[i].children.length > 0) {
              if (removeImageFromNote(nodes[i].children)) {
                return true;
              }
            }
          }
          
          return false;
        };
        
        removeImageFromNote(updatedNotes);
        return updatedNotes;
      });
      
      // Update the selected note if it contains the image
      if (selectedNote && selectedNote.images && selectedNote.images.some(img => img.id === imageId)) {
        setSelectedNote(prevSelected => {
          if (!prevSelected) return null;
          
          const updatedSelected = { ...prevSelected };
          if (updatedSelected.images) {
            updatedSelected.images = updatedSelected.images.filter(img => img.id !== imageId);
          }
          return updatedSelected;
        });
      }
      
      toast({
        title: "Image Removed",
        description: "Image has been removed from the note",
      });
      
      return true;
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: "Removal Failed",
        description: "An error occurred while removing the image",
        variant: "destructive",
      });
      return false;
    }
  }, [currentProjectId, selectedNote, toast]);

  // Reorder images within a note
  const reorderImage = useCallback(async (noteId: string, imageId: string, newPosition: number): Promise<boolean> => {
    if (!currentProjectId) {
      toast({
        title: "Operation Failed",
        description: "You need to have an active project to reorder images",
        variant: "destructive",
      });
      return false;
    }

    try {
      const success = await updateImagePosition(noteId, imageId, newPosition);
      
      if (!success) {
        toast({
          title: "Reorder Failed",
          description: "Failed to reorder image. Please try again.",
          variant: "destructive",
        });
        return false;
      }
      
      // Update the notes state to reflect the new position
      setNotes(prevNotes => {
        const updatedNotes = [...prevNotes];
        
        // Function to find and update the image position in a note
        const updateImageInNote = (nodes: Note[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            // Check if this is the note with the image
            if (nodes[i].id === noteId && nodes[i].images && nodes[i].images.length > 0) {
              // Find the image to move
              const imageIndex = nodes[i].images.findIndex(img => img.id === imageId);
              if (imageIndex !== -1) {
                // Get the image to move
                const image = nodes[i].images[imageIndex];
                
                // Remove from current position
                nodes[i].images.splice(imageIndex, 1);
                
                // Insert at new position
                const insertPos = Math.min(newPosition, nodes[i].images.length);
                nodes[i].images.splice(insertPos, 0, image);
                
                // Update position property on all images to match their index
                nodes[i].images.forEach((img, idx) => {
                  img.position = idx;
                });
                
                return true;
              }
            }
            
            // Check children
            if (nodes[i].children.length > 0) {
              if (updateImageInNote(nodes[i].children)) {
                return true;
              }
            }
          }
          
          return false;
        };
        
        updateImageInNote(updatedNotes);
        return updatedNotes;
      });
      
      // Update the selected note if it's the note containing the image
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(prevSelected => {
          if (!prevSelected || !prevSelected.images) return prevSelected;
          
          const updatedSelected = { ...prevSelected };
          
          // Find the image to move
          const imageIndex = updatedSelected.images.findIndex(img => img.id === imageId);
          if (imageIndex !== -1) {
            // Get the image to move
            const image = updatedSelected.images[imageIndex];
            
            // Remove from current position
            updatedSelected.images.splice(imageIndex, 1);
            
            // Insert at new position
            const insertPos = Math.min(newPosition, updatedSelected.images.length);
            updatedSelected.images.splice(insertPos, 0, image);
            
            // Update position property on all images
            updatedSelected.images.forEach((img, idx) => {
              img.position = idx;
            });
          }
          
          return updatedSelected;
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error reordering image:', error);
      toast({
        title: "Reorder Failed",
        description: "An error occurred while reordering the image",
        variant: "destructive",
      });
      return false;
    }
  }, [currentProjectId, selectedNote, toast]);
  
  // Debug info function to examine project state
  const debugInfo = useCallback(() => {
    return {
      hasActiveProject,
      currentProjectId,
      currentProjectName,
      noteCount: notes.length,
      selectedNoteId: selectedNote?.id || null,
      firstNoteId: notes.length > 0 ? notes[0].id : null,
      firstNoteContent: notes.length > 0 ? notes[0].content : null,
      expandedNodesCount: expandedNodes.size,
      breadcrumbsCount: breadcrumbs.length
    };
  }, [hasActiveProject, currentProjectId, currentProjectName, notes, selectedNote, expandedNodes, breadcrumbs]);

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
        currentProjectName,
        setCurrentProjectName,
        hasActiveProject,
        setHasActiveProject,
        createNewProject,
        saveProject,
        currentProjectId,
        setCurrentProjectId,
        debugInfo,
        uploadImage,
        removeImage,
        reorderImage
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
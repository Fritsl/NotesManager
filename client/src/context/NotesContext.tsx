import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useRef, useEffect } from "react";
import { Note, NotesData, NoteImage } from "@/types/notes";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { createProject, updateProject, addImageToNote, removeImageFromNote, updateImagePosition, getProject } from "@/lib/projectService";

// State to track pending note movements that need to be saved
let pendingNoteMoves = false;

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
  currentProjectDescription: string;
  setCurrentProjectDescription: (description: string) => void;
  hasActiveProject: boolean;
  setHasActiveProject: (hasProject: boolean) => void;
  createNewProject: (name: string) => void;
  saveProject: () => Promise<any>;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  uploadImage: (noteId: string, file: File) => Promise<NoteImage | null>;
  removeImage: (imageId: string) => Promise<boolean>;
  reorderImage: (noteId: string, imageId: string, newPosition: number) => Promise<boolean>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

// Define the interface for URL parameters
interface UrlParams {
  projectId: string | null;
  noteId: string | null;
}

export function NotesProvider({ children, urlParams }: { children: ReactNode; urlParams: UrlParams }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Note[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [currentProjectDescription, setCurrentProjectDescription] = useState<string>('');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [hasActiveProject, setHasActiveProject] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isAutoLoading, setIsAutoLoading] = useState<boolean>(false);
  // State to track pending note movements that need to be saved
  const [pendingNoteMoves, setPendingNoteMoves] = useState<boolean>(false);
  const { toast } = useToast();

  // Auto-load the last accessed project on initial mount
  useEffect(() => {
    const loadLastProject = async () => {
      // Only attempt to load if this is the initial load
      if (!isInitialLoad) return;
      
      try {
        // Get the last project ID from localStorage
        const lastProjectId = localStorage.getItem('lastProjectId');
        
        // If we have a last project ID, try to load it
        if (lastProjectId) {
          console.log('Auto-loading last project ID:', lastProjectId);
          setIsAutoLoading(true);
          
          // Fetch the project from the database
          const project = await getProject(lastProjectId);
          
          if (project) {
            console.log('Auto-loaded project:', project.name);
            
            // Import the notes from the project
            importNotes(project.data, project.name, project.id);
            
            // Set project description if available
            if (project.description) {
              setCurrentProjectDescription(project.description);
            }
            
            // Mark as having an active project
            setHasActiveProject(true);
            
            toast({
              title: 'Project Loaded',
              description: `Automatically loaded "${project.name}"`,
            });
          } else {
            console.log('Auto-load failed: Project not found');
            // Clear the invalid project ID from localStorage
            localStorage.removeItem('lastProjectId');
          }
        } else {
          console.log('No last project ID found in localStorage');
        }
      } catch (error) {
        console.error('Error auto-loading last project:', error);
      } finally {
        setIsInitialLoad(false);
        setIsAutoLoading(false);
      }
    };
    
    // Execute the auto-load function
    loadLastProject();
  }, []);

  // Update localStorage whenever currentProjectId changes
  useEffect(() => {
    if (currentProjectId) {
      // Store the current project ID in localStorage
      localStorage.setItem('lastProjectId', currentProjectId);
      console.log('Saved last project ID to localStorage:', currentProjectId);
    }
  }, [currentProjectId]);
  
  // Clean note positions to ensure sequential ordering without gaps
  const cleanNotePositions = useCallback((noteList: Note[]): Note[] => {
    // Sort the notes by their current position
    const sortedNotes = [...noteList].sort((a, b) => a.position - b.position);
    
    // Reassign positions sequentially starting from 0
    const cleanedNotes = sortedNotes.map((note, index) => {
      // Preserve all original note properties including images
      return {
        ...note,
        position: index,
        // Recursively clean child positions while preserving other properties
        children: note.children.length > 0 ? cleanNotePositions(note.children) : [],
        // CRITICAL: Explicitly preserve images array if it exists
        images: note.images || [],
      };
    });
    
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
    
    // Process notes to ensure compatible image format
    const processImagesInNotes = (noteList: Note[]): Note[] => {
      return noteList.map(note => {
        // Create a new note to avoid mutating the original
        const processedNote: Note = {
          ...note,
          children: note.children ? processImagesInNotes(note.children) : []
        };
        
        // Process images if present
        if (note.images && note.images.length > 0) {
          processedNote.images = note.images.map((image, index) => {
            // If the image is in the simplified format (missing id, note_id, created_at),
            // enhance it with the required fields for this application
            const enhancedImage: NoteImage = {
              ...image,
              id: image.id || uuidv4(), // Generate an ID if missing
              note_id: image.note_id || note.id, // Use note's ID if missing
              created_at: image.created_at || new Date().toISOString(), // Use current time if missing
              url: image.url,
              storage_path: image.storage_path,
              position: image.position !== undefined ? image.position : index
            };
            
            return enhancedImage;
          });
        }
        
        return processedNote;
      });
    };
    
    // Process the notes to ensure compatible image format, then clean positions
    const processedNotes = processImagesInNotes(data.notes);
    console.log('Cleaning note positions for', processedNotes.length, 'notes');
    const cleanedNotes = cleanNotePositions(processedNotes);
    console.log('Cleaned notes:', cleanedNotes);
    
    setNotes(cleanedNotes);
    setSelectedNote(null);
    setBreadcrumbs([]);
    
    // Update project name if provided
    if (projectName) {
      setCurrentProjectName(projectName);
    }
    
    // Only update the project ID if explicitly provided
    // Otherwise keep the current project ID to maintain save functionality
    if (projectId !== undefined) {
      setCurrentProjectId(projectId || null);
    }
    // currentProjectId remains unchanged if projectId is undefined
    
    // Always set hasActiveProject to true when importing notes
    setHasActiveProject(true);
    
    toast({
      title: "Import Successful",
      description: `Imported ${data.notes.length} notes${projectName ? ` from "${projectName}"` : ''}`,
    });
  }, [toast, cleanNotePositions]);

  // Export notes to JSON
  const exportNotes = useCallback((): NotesData => {
    // Helper function to convert notes for export and reorder fields
    const formatNotesForExport = (noteList: Note[]): Note[] => {
      return noteList.map(note => {
        // Prepare simplified images if any
        const simplifiedImages = note.images && note.images.length > 0 
          ? note.images.map(image => ({
              // Only include the fields expected by other applications
              url: image.url,
              storage_path: image.storage_path,
              position: image.position
            } as NoteImage))
          : [];
            
        // Create a completely new note object with fields in the exact order needed
        // for compatibility with other applications
        const exportedNote: Note = {
          id: note.id,
          content: note.content,
          position: note.position,
          is_discussion: note.is_discussion,
          time_set: note.time_set,
          youtube_url: note.youtube_url,
          url: note.url,
          url_display_text: note.url_display_text,
          // First include images (before children)
          images: simplifiedImages,
          // Then include children (after images)
          children: note.children ? formatNotesForExport(note.children) : []
        };
        
        return exportedNote;
      });
    };
    
    return { notes: formatNotesForExport(notes) };
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
    // Format the time_set correctly if present (ensure no seconds)
    let formattedNote = { ...updatedNote };
    if (formattedNote.time_set) {
      // Extract just the HH:MM part if there's more
      const timeParts = formattedNote.time_set.split(':');
      if (timeParts.length >= 2) {
        // Only use hours and minutes, no seconds
        formattedNote.time_set = `${timeParts[0]}:${timeParts[1]}`;
      }
    }
    
    setNotes((prevNotes) => {
      const updatedNotes = [...prevNotes];
      
      // Find the note at any level in the tree
      const updateNoteInTree = (nodes: Note[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === formattedNote.id) {
            // Preserve critical properties if not provided in the update
            if (!formattedNote.children || formattedNote.children.length === 0) {
              formattedNote.children = nodes[i].children;
            }
            
            // CRITICAL: Preserve the images array if not explicitly provided
            // This ensures images don't get lost during regular note updates
            if (!formattedNote.images || !Array.isArray(formattedNote.images)) {
              formattedNote.images = nodes[i].images || [];
            }
            
            // Update the node with the formatted note that preserves images
            nodes[i] = { 
              ...formattedNote,
              // Double ensure images are preserved by explicitly setting them
              images: formattedNote.images
            };
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
    
    // Make sure the selected note also has the images preserved
    setSelectedNote(formattedNote);
    
    toast({
      title: "Note Updated",
      description: "Your changes have been saved",
    });
  }, [toast]);

  // Delete a note
  const deleteNote = useCallback((noteId: string) => {
    setNotes((prevNotes) => {
      const updatedNotes = [...prevNotes];
      // Create a variable to keep track of the parent note that had a child removed
      let parentNote: Note | null = null;
      
      // Find and remove the note at any level in the tree
      const removeNoteFromTree = (nodes: Note[], parent: Note | null = null): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === noteId) {
            nodes.splice(i, 1);
            // Keep track of parent that had a child removed
            parentNote = parent;
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
      if (parentNote) {
        // Update the positions of the remaining children
        // Cast to Note to avoid type errors - we know this is a valid parent note
        const typedParent = parentNote as Note;
        if (typedParent.children && typedParent.children.length > 0) {
          typedParent.children = typedParent.children.map((child: Note, index: number) => ({
            ...child,
            position: index
          }));
        }
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
  const moveNote = useCallback(async (noteId: string, targetParentId: string | null, position: number) => {
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
      const resultNotes = cleanNotePositions(updatedNotes);
      
      // Set flag to trigger saving in an effect
      setPendingNoteMoves(true);
      
      return resultNotes;
    });
  }, [findNoteAndParent, cleanNotePositions]);

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

  // Handle deep linking from URL parameters
  useEffect(() => {
    // Skip if no URL parameters or if we're still auto-loading a project
    if (isAutoLoading || isInitialLoad) return;
    
    const handleDeepLink = async () => {
      try {
        const { projectId, noteId } = urlParams;
        
        console.log('Checking deep link parameters:', { projectId, noteId });
        
        // Only proceed if we have a project ID
        if (!projectId) return;
        
        // Check if this project is already loaded
        if (currentProjectId === projectId) {
          console.log('Project already loaded, navigating to specific note if needed');
          
          // If we have a note ID, find and select it
          if (noteId) {
            const { note: foundNote } = findNoteAndPath(noteId);
            if (foundNote) {
              // Select the note and expand to it
              selectNote(foundNote);
              
              // Expand all parent notes to make the target note visible
              const { path } = findNoteAndPath(noteId);
              
              // Create a new Set with all the path note IDs
              const newExpandedNodes = new Set(expandedNodes);
              path.forEach(pathNote => {
                newExpandedNodes.add(pathNote.id);
              });
              
              setExpandedNodes(newExpandedNodes);
              
              toast({
                title: "Note Located",
                description: "Navigated to the requested note",
              });
            } else {
              toast({
                title: "Note Not Found",
                description: "The requested note could not be found in this project",
                variant: "destructive",
              });
            }
          }
        } else {
          // Need to load a different project
          console.log('Loading project from deep link:', projectId);
          
          const project = await getProject(projectId);
          
          if (project) {
            console.log('Deep link loaded project:', project.name);
            
            // Import the notes from the project
            importNotes(project.data, project.name, project.id);
            
            // Set project description if available
            if (project.description) {
              setCurrentProjectDescription(project.description);
            }
            
            // Mark as having an active project
            setHasActiveProject(true);
            
            toast({
              title: 'Project Loaded',
              description: `Loaded "${project.name}" from shared link`,
            });
            
            // If we also have a note ID, wait a bit for the project to load then select the note
            if (noteId) {
              // Use setTimeout to give the project time to fully load and render
              setTimeout(() => {
                const { note: foundNote } = findNoteAndPath(noteId);
                if (foundNote) {
                  // Select the note and expand to it
                  selectNote(foundNote);
                  
                  // Expand all parent notes to make the target note visible
                  const { path } = findNoteAndPath(noteId);
                  
                  // Create a new Set with all the path note IDs
                  const newExpandedNodes = new Set(expandedNodes);
                  path.forEach(pathNote => {
                    newExpandedNodes.add(pathNote.id);
                  });
                  
                  setExpandedNodes(newExpandedNodes);
                  
                  toast({
                    title: "Note Located",
                    description: "Navigated to the requested note",
                  });
                }
              }, 500); // Wait half a second for the project to load
            }
          } else {
            toast({
              title: "Project Not Found",
              description: "The requested project could not be found",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
        toast({
          title: "Navigation Error",
          description: "Could not navigate to the requested content",
          variant: "destructive",
        });
      }
    };
    
    // Only run if we have URL parameters and the app is ready
    if (urlParams.projectId) {
      handleDeepLink();
    }
  }, [urlParams, isAutoLoading, isInitialLoad, currentProjectId, findNoteAndPath, selectNote, expandedNodes, toast, importNotes]);

  // Calculate the depth of the tree (memoized)
  const maxDepth = useMemo(() => {
    return calculateMaxDepth(notes);
  }, [notes, calculateMaxDepth]);

  // Expand nodes up to a certain level
  const expandToLevel = useCallback((level: number) => {
    // Use the level as is - the UI buttons are already 0-indexed (L0, L1, L2, etc.)
    const targetLevel = level;
    
    // Always reset expanded nodes first
    setExpandedNodes(new Set());
    
    // Update the current level value regardless of level
    setCurrentLevel(level);
    
    if (targetLevel <= 0) {
      // Level 0 means collapse all, just return with empty set of expanded nodes
      return;
    }
    
    const newExpandedNodes = new Set<string>();
    
    // Helper function to traverse the tree and expand nodes up to the specified level
    const expandLevels = (nodes: Note[], currentLevel = 0) => {
      if (currentLevel >= targetLevel) {
        return;
      }
      
      for (const note of nodes) {
        // Add all nodes that are at levels LESS than the target level
        // This ensures that L1 shows level 0 nodes, L2 shows levels 0 and 1, etc.
        newExpandedNodes.add(note.id);
        
        // Recursively process children if they exist
        if (note.children && note.children.length > 0) {
          expandLevels(note.children, currentLevel + 1);
        }
      }
    };
    
    expandLevels(notes);
    setExpandedNodes(newExpandedNodes);
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
        description: currentProjectDescription,
        notesCount: notes.length,
        firstNote: notes.length > 0 ? notes[0].content : 'No notes'
      });
      
      // Create a clean copy of the notes data to save
      const notesData: NotesData = { notes: cleanNotePositions([...notes]) };
      
      // Update the project in the database
      const updatedProject = await updateProject(
        currentProjectId, 
        currentProjectName, 
        notesData, 
        currentProjectDescription
      );
      
      if (!updatedProject) {
        console.error('Failed to update project');
        toast({
          title: "Error Saving Project",
          description: "Could not save the project. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Dispatch a custom event to notify components that a project has been updated
      // This will be used to refresh the projects list in ProjectsModal
      const projectUpdatedEvent = new CustomEvent('project-updated', {
        detail: { projectId: currentProjectId }
      });
      window.dispatchEvent(projectUpdatedEvent);
      
      console.log('Project saved successfully:', updatedProject);
      
      // Only show toast when manually saved via button (not auto-saves)
      if (!pendingNoteMoves) {
        toast({
          title: "Project Saved",
          description: `"${currentProjectName}" has been saved`,
        });
      }
      
      // Clear the pending flag if it was set
      if (pendingNoteMoves) {
        setPendingNoteMoves(false);
      }
      
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: "Error Saving Project",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  }, [currentProjectId, currentProjectName, currentProjectDescription, notes, cleanNotePositions, toast, pendingNoteMoves]);
  
  // Effect to handle auto-saving when pendingNoteMoves is set
  useEffect(() => {
    if (pendingNoteMoves && currentProjectId) {
      console.log('Auto-saving project after note movement');
      const saveTimeout = setTimeout(() => {
        saveProject().then(() => {
          console.log('Project auto-saved after note movement');
        }).catch(err => {
          console.error('Failed to auto-save after note movement:', err);
        });
      }, 500);
      
      return () => {
        clearTimeout(saveTimeout);
      };
    }
  }, [pendingNoteMoves, currentProjectId, saveProject]);

  // Handle image uploads for a note
  const uploadImage = useCallback(async (noteId: string, file: File): Promise<NoteImage | null> => {
    try {
      console.log(`Uploading image for note ${noteId}`);
      const image = await addImageToNote(noteId, file);
      
      if (image) {
        // Update the notes state to include the new image
        setNotes(prevNotes => {
          // Create a deep copy of the notes array with the updated note
          return prevNotes.map(note => {
            if (note.id === noteId) {
              // If this is the target note, add the image to its images array
              return {
                ...note,
                images: [...(note.images || []), image]
              };
            } else if (note.children && note.children.length > 0) {
              // If this note has children, recursively search them
              const updateChildrenWithImage = (children: Note[]): Note[] => {
                return children.map(child => {
                  if (child.id === noteId) {
                    return {
                      ...child,
                      images: [...(child.images || []), image]
                    };
                  } else if (child.children && child.children.length > 0) {
                    return {
                      ...child,
                      children: updateChildrenWithImage(child.children)
                    };
                  }
                  return child;
                });
              };
              
              return {
                ...note,
                children: updateChildrenWithImage(note.children)
              };
            }
            return note;
          });
        });

        toast({
          title: "Image Uploaded",
          description: "The image has been attached to the note",
        });
        
        // Save the project to ensure the image is persisted
        saveProject().catch(err => {
          console.error("Error saving project after image upload:", err);
        });
      }
      
      return image;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Could not upload the image",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, saveProject]);
  
  // Remove an image from a note
  const removeImage = useCallback(async (imageId: string): Promise<boolean> => {
    try {
      console.log(`Removing image ${imageId}`);
      const success = await removeImageFromNote(imageId);
      
      if (success) {
        // Update the notes state to remove the image
        setNotes(prevNotes => {
          // Create a deep copy of the notes array with the image removed
          // Helper function to update a notes array by removing the specified image
          const removeImageFromNotes = (notes: Note[]): Note[] => {
            return notes.map(note => {
              // Check if this note has the image
              if (note.images && note.images.some(img => img.id === imageId)) {
                return {
                  ...note,
                  images: note.images.filter(img => img.id !== imageId)
                };
              }
              
              // If the note has children, recursively check them
              if (note.children && note.children.length > 0) {
                return {
                  ...note,
                  children: removeImageFromNotes(note.children)
                };
              }
              
              // No changes needed for this note
              return note;
            });
          };
          
          return removeImageFromNotes(prevNotes);
        });

        toast({
          title: "Image Removed",
          description: "The image has been removed from the note",
        });
        
        // Save the project to ensure the image removal is persisted
        saveProject().catch(err => {
          console.error("Error saving project after image removal:", err);
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: "Remove Failed",
        description: error instanceof Error ? error.message : "Could not remove the image",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, saveProject]);
  
  // Reorder images within a note
  const reorderImage = useCallback(async (noteId: string, imageId: string, newPosition: number): Promise<boolean> => {
    try {
      console.log(`Reordering image ${imageId} to position ${newPosition}`);
      const success = await updateImagePosition(noteId, imageId, newPosition);
      
      if (success) {
        // Update the notes state to reflect the new image position
        setNotes(prevNotes => {
          // Helper function to update the images array for a note
          const updateImagesInNote = (note: Note): Note => {
            if (note.id === noteId && note.images && note.images.length > 0) {
              // Find the image to reorder
              const imageToMove = note.images.find(img => img.id === imageId);
              
              if (imageToMove) {
                // Remove the image from its current position
                const filteredImages = note.images.filter(img => img.id !== imageId);
                
                // Calculate a safe position that's within bounds
                const safePosition = Math.max(0, Math.min(newPosition, filteredImages.length));
                
                // Insert the image at the new position
                const updatedImages = [
                  ...filteredImages.slice(0, safePosition),
                  { ...imageToMove, position: safePosition },
                  ...filteredImages.slice(safePosition)
                ];
                
                // Sort images by position to ensure correct order
                const sortedImages = updatedImages.sort((a, b) => a.position - b.position);
                
                return { ...note, images: sortedImages };
              }
            }
            return note;
          };
          
          // Helper function to update notes recursively
          const updateNotesWithReorderedImage = (notes: Note[]): Note[] => {
            return notes.map(note => {
              // First check if this is the note with the image
              const updatedNote = updateImagesInNote(note);
              
              // If the note has children, recursively update them too
              if (updatedNote.children && updatedNote.children.length > 0) {
                return {
                  ...updatedNote,
                  children: updateNotesWithReorderedImage(updatedNote.children)
                };
              }
              
              return updatedNote;
            });
          };
          
          return updateNotesWithReorderedImage(prevNotes);
        });

        toast({
          title: "Image Reordered",
          description: "The image position has been updated",
        });
        
        // Save the project to ensure the image reordering is persisted
        saveProject().catch(err => {
          console.error("Error saving project after image reordering:", err);
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error reordering image:', error);
      toast({
        title: "Reorder Failed",
        description: error instanceof Error ? error.message : "Could not reorder the image",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, saveProject]);

  // Debug info function removed

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
        currentProjectDescription,
        setCurrentProjectDescription,
        hasActiveProject,
        setHasActiveProject,
        createNewProject,
        saveProject,
        currentProjectId,
        setCurrentProjectId,
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
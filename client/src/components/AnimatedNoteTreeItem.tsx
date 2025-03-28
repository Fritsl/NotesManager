import { useRef, useState, useEffect } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Link, Youtube, ArrowDownRightFromCircle, MessageCircle, Clock, MoveHorizontal, Save, Check, Edit, X, Upload, ImagePlus } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { cn } from "@/lib/utils";
import DropZone from "./DropZone";
import { levelColors } from "@/lib/level-colors";
import MoveNoteModal from "./MoveNoteModal";
import ColorPicker from "./ColorPicker";
import { convertLegacyColorToValue, getColorFromValue, getNoteBackgroundStyle } from "@/lib/color-utils";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/useMediaQuery";
import ImageWithFallback from "@/components/ui/image-with-fallback";
import { handleToast } from "@/lib/errorToast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";

// Re-use utility functions from the original NoteTreeItem
// Import just the component reference
import NoteTreeItem from "./NoteTreeItem";

// Define the utility functions directly in this file since they're not exported from NoteTreeItem
// Helper function to calculate time between notes
const parseTimeSet = (timeStr: string | null): number | null => {
  if (!timeStr) return null;
  
  // Parse time in format "HH:MM:SS" or "HH:MM"
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  
  // Convert to total minutes
  return hours * 60 + minutes + seconds / 60;
};

// Format minutes to MM:SS string
const formatTimeAllocation = (minutes: number): string => {
  if (minutes < 0) return "--:--";
  
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  
  return `${wholeMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Find the next note with time_set in a flattened array
const findNextNoteWithTime = (notes: Note[], currentNoteId: string): Note | null => {
  const flattenedNotes: Note[] = [];
  
  // Function to flatten the tree into an array in the order notes appear
  const flattenTree = (notesArray: Note[], parentId: string | null = null) => {
    notesArray.forEach(note => {
      flattenedNotes.push(note);
      if (note.children && note.children.length > 0) {
        flattenTree(note.children, note.id);
      }
    });
  };
  
  // Flatten the tree
  flattenTree(notes);
  
  // Find current note index
  const currentIndex = flattenedNotes.findIndex(note => note.id === currentNoteId);
  if (currentIndex === -1) return null;
  
  // Find next note with time_set
  for (let i = currentIndex + 1; i < flattenedNotes.length; i++) {
    if (flattenedNotes[i].time_set) {
      return flattenedNotes[i];
    }
  }
  
  return null;
};

// Function to count all descendants (direct and indirect children) of a note
const getTotalChildrenCount = (currentNote: Note): number => {
  if (!currentNote.children || currentNote.children.length === 0) {
    return 0;
  }
  
  let totalCount = currentNote.children.length; // Count direct children
  
  // Add their children too (recursively)
  for (const child of currentNote.children) {
    totalCount += getTotalChildrenCount(child);
  }
  
  return totalCount;
};

// Count notes between two notes in the flattened tree
const countNotesBetween = (notes: Note[], startNoteId: string, endNoteId: string): number => {
  // For adjacent timed notes without any notes in between, we count only the two timed notes
  // This means we return 2 (the start note and the end note)
  
  const flattenedNotes: Note[] = [];
  
  // Function to flatten the tree into an array in the order notes appear
  const flattenTree = (notesArray: Note[]) => {
    notesArray.forEach(note => {
      flattenedNotes.push(note);
      if (note.children && note.children.length > 0) {
        flattenTree(note.children);
      }
    });
  };
  
  // Flatten the tree
  flattenTree(notes);
  
  // Find start and end indices
  const startIndex = flattenedNotes.findIndex(note => note.id === startNoteId);
  const endIndex = flattenedNotes.findIndex(note => note.id === endNoteId);
  
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return 0;
  }
  
  // Check if notes are adjacent in the flattened tree (or have only timed notes between them)
  let intermediateNoteCount = 0;
  for (let i = startIndex + 1; i < endIndex; i++) {
    intermediateNoteCount++;
  }
  
  // If there are no notes between, or just the end note, return 2 (start and end)
  if (intermediateNoteCount === 0) {
    return 2; // Count the start and end notes
  } else {
    // Otherwise return the total count including start and end
    return intermediateNoteCount + 2; 
  }
};

// Calculate time allocation for each note
interface TimeAllocationResult {
  formattedTime: string;
  noteCount: number;
  totalMinutes: number;
}

const calculateTimeAllocation = (currentNote: Note, allNotes: Note[]): TimeAllocationResult | null => {
  if (!currentNote.time_set) return null;
  
  console.log("🕒 Calculating time for note:", currentNote.id, currentNote.content.substring(0, 20));
  
  // Find the next note with time_set
  const nextTimedNote = findNextNoteWithTime(allNotes, currentNote.id);
  console.log("🕒 Next timed note:", nextTimedNote ? 
    `${nextTimedNote.id} - ${nextTimedNote.content.substring(0, 20)}` : "none");
  
  let noteCount = 0;
  let totalMinutes = 0;
  let formattedTime = "";
  
  if (!nextTimedNote || !nextTimedNote.time_set) {
    console.log("🕒 No next timed note found, returning null");
    // If this is the last timed note, don't show any calculation
    // since we can't calculate time to "next" timed note
    return null;
  }
  
  // Parse time values
  const currentTime = parseTimeSet(currentNote.time_set);
  const nextTime = parseTimeSet(nextTimedNote.time_set);
  console.log("🕒 Time values:", currentNote.time_set, nextTimedNote.time_set);
  
  if (currentTime === null || nextTime === null) return null;
  
  // Calculate time difference in minutes, handle wrapping across midnight
  let timeDiff = nextTime - currentTime;
  if (timeDiff <= 0) {
    // If next time is earlier than current time, assume it's the next day
    // Add 24 hours (1440 minutes) to get proper difference
    timeDiff = timeDiff + (24 * 60);
  }
  console.log("🕒 Time difference (minutes):", timeDiff);
  
  // IMPORTANT FIX: First find the direct route between the two timed notes
  // We're going to directly count the exact number of slides between them
  // This will fix issues with counting notes in different branches

  // Flatten the tree to get all nodes in display order
  const flattenedNotes: Note[] = [];
  const flattenTree = (notesArray: Note[]) => {
    notesArray.forEach(note => {
      flattenedNotes.push(note);
      if (note.children && note.children.length > 0) {
        flattenTree(note.children);
      }
    });
  };
  flattenTree(allNotes);
  
  // Find positions of both timed notes in the flattened tree
  const currentIndex = flattenedNotes.findIndex(note => note.id === currentNote.id);
  const nextIndex = flattenedNotes.findIndex(note => note.id === nextTimedNote.id);
  
  if (currentIndex >= 0 && nextIndex >= 0) {
    // Count notes between, but EXCLUDE the next timed note (we only want to count
    // the current timed note and all slides UNTIL the next timed note)
    noteCount = (nextIndex - currentIndex);
    console.log("🕒 Slide positions in tree:", currentIndex, nextIndex);
    console.log("🕒 Total slide count (excluding next timed note):", noteCount);
  } else {
    // Fallback to old method if indexes aren't found
    console.log("🕒 Using fallback counting method");
    noteCount = 1; // Default to just the current timed note
  }
  
  if (noteCount <= 0) {
    console.log("🕒 Note count is invalid, using default");
    formattedTime = "05:00"; // Default 5 minutes if there are no notes between
    totalMinutes = 5;
    return { formattedTime, noteCount: 1, totalMinutes };
  }
  
  // Calculate time per note in minutes
  const timePerNote = timeDiff / noteCount;
  totalMinutes = timeDiff;
  console.log("🕒 Minutes per slide:", timePerNote);
  
  // Format as MM:SS
  formattedTime = formatTimeAllocation(timePerNote);
  
  console.log("🕒 Final calculation:", { formattedTime, noteCount, totalMinutes });
  return { formattedTime, noteCount, totalMinutes };
};

interface NoteTreeItemProps {
  note: Note;
  level: number;
  toggleExpand: (noteId: string) => void;
  isExpanded: boolean;
  index?: number;
  isRoot?: boolean;
  parentId?: string | null;
}

interface DragItem {
  type: string;
  id: string;
  index?: number;
  isRoot?: boolean;
}

export default function AnimatedNoteTreeItem({ 
  note, 
  level, 
  toggleExpand, 
  isExpanded, 
  index = 0, 
  isRoot = false, 
  parentId = null 
}: NoteTreeItemProps) {
  const { 
    selectedNote, 
    selectNote, 
    addNote, 
    deleteNote, 
    moveNote, 
    expandedNodes, 
    notes, 
    updateNote, 
    saveProject,
    uploadImage,
    removeImage,
    reorderImage
  } = useNotes();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // References - use a mutable ref for the container div (for drag-drop)
  const ref = useRef<HTMLDivElement | null>(null);
  const contentEditRef = useRef<HTMLTextAreaElement>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [editTimeSet, setEditTimeSet] = useState<string | null>(note.time_set);
  const [editIsDiscussion, setEditIsDiscussion] = useState(note.is_discussion);
  const [editYoutubeUrl, setEditYoutubeUrl] = useState<string | null>(note.youtube_url);
  const [editUrl, setEditUrl] = useState<string | null>(note.url);
  const [editUrlDisplayText, setEditUrlDisplayText] = useState<string | null>(note.url_display_text);
  const [editColor, setEditColor] = useState<number | null>(
    typeof note.color === 'number' ? note.color : 
    (note.color ? convertLegacyColorToValue(note.color) : 0)
  );
  const [isSaving, setIsSaving] = useState(false);

  // Motion values for physics-based animations
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const boxShadow = useMotionValue("0px 0px 0px rgba(0,0,0,0)");
  
  // Spring animations for smooth physics
  const springX = useSpring(x, { stiffness: 400, damping: 30 });
  const springY = useSpring(y, { stiffness: 400, damping: 30 });
  const springScale = useSpring(scale, { stiffness: 500, damping: 25 });
  const springRotate = useSpring(0, { stiffness: 500, damping: 30 });
  
  // Animation states for different drag events
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);

  // Setup drag with Framer Motion integration
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'NOTE',
    item: (monitor) => {
      setIsBeingDragged(true);
      // Apply lift effect
      scale.set(1.03);
      boxShadow.set("0px 8px 20px rgba(0,0,0,0.25)");
      
      // Add a subtle rotation based on cursor position for natural movement
      const clientOffset = monitor.getClientOffset();
      if (clientOffset && ref.current) {
        const initialRect = ref.current.getBoundingClientRect();
        const initialCenterX = initialRect.left + initialRect.width / 2;
        const distanceFromCenter = (clientOffset.x - initialCenterX) / 100;
        springRotate.set(distanceFromCenter * 2); // Subtle rotation
      }
      
      return { type: 'NOTE', id: note.id, index, isRoot };
    },
    canDrag: !isEditing,
    end: () => {
      setIsBeingDragged(false);
      // Reset animation values
      springX.set(0);
      springY.set(0);
      springScale.set(1);
      springRotate.set(0);
      boxShadow.set("0px 0px 0px rgba(0,0,0,0)");
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  // Helper to check if a note is a descendant of another
  const isDescendantOf = (sourceId: string, targetId: string): boolean => {
    // Can't be a descendant of itself
    if (sourceId === targetId) return false;

    // Find the source note
    const findNoteById = (id: string, notesList: Note[]): Note | null => {
      for (const n of notesList) {
        if (n.id === id) return n;
        if (n.children.length > 0) {
          const found = findNoteById(id, n.children);
          if (found) return found;
        }
      }
      return null;
    };

    const sourceNote = findNoteById(sourceId, notes);
    if (!sourceNote) return false;

    // Check if targetId is a descendant of sourceNote
    const checkIfDescendant = (node: Note, targetNodeId: string): boolean => {
      for (const child of node.children) {
        if (child.id === targetNodeId) return true;
        if (checkIfDescendant(child, targetNodeId)) return true;
      }
      return false;
    };

    return checkIfDescendant(sourceNote, targetId);
  };

  // Enhanced drop detection with position information and physics animations
  const [{ isOver, isOverRight, isOverTop, isOverBottom }, drop] = useDrop<
    DragItem, 
    void, 
    { isOver: boolean, isOverRight: boolean, isOverTop: boolean, isOverBottom: boolean }
  >({
    accept: 'NOTE',
    canDrop: (item) => !isEditing && item.id !== note.id && !isDescendantOf(item.id, note.id),
    hover: (item, monitor) => {
      if (!ref.current || item.id === note.id) return;

      // Get drop position relative to the target note
      const clientOffset = monitor.getClientOffset();
      const hoverBoundingRect = ref.current.getBoundingClientRect();

      if (clientOffset && hoverBoundingRect) {
        // Get the position within the note (vertically and horizontally)
        const noteHeight = hoverBoundingRect.bottom - hoverBoundingRect.top;
        const noteWidth = hoverBoundingRect.right - hoverBoundingRect.left;

        // Calculate thresholds - make the right zone larger and more obvious
        const topThreshold = noteHeight * 0.25; // Top 25% = "Above" zone
        const bottomThreshold = noteHeight * 0.75; // Bottom 25% = "Below" zone
        const rightThreshold = noteWidth * 0.7; // Right 30% = "Inside" zone

        // Get mouse position relative to the note
        const offsetY = clientOffset.y - hoverBoundingRect.top;
        const offsetX = clientOffset.x - hoverBoundingRect.left;

        // Calculate drop position
        const isRightZone = offsetX > rightThreshold;
        const isTopZone = offsetY < topThreshold && !isRightZone;
        const isBottomZone = offsetY > bottomThreshold && !isRightZone;

        // Update animation state based on drop position
        setIsDropTarget(true);
        if (isRightZone) {
          setDropPosition('inside');
        } else if (isTopZone) {
          setDropPosition('above');
        } else if (isBottomZone) {
          setDropPosition('below');
        } else {
          setDropPosition(null);
        }
      }
    },
    drop: (item, monitor) => {
      if (item.id !== note.id) {
        // Get the dragged note ID
        const draggedItemId = item.id;

        // Don't allow dropping onto self
        if (note.id === draggedItemId) {
          return;
        }

        // Get drop position relative to the target note
        const clientOffset = monitor.getClientOffset();
        const hoverBoundingRect = ref.current?.getBoundingClientRect();

        if (clientOffset && hoverBoundingRect) {
          // Get the position within the note (vertically and horizontally)
          const noteHeight = hoverBoundingRect.bottom - hoverBoundingRect.top;
          const noteWidth = hoverBoundingRect.right - hoverBoundingRect.left;

          // Calculate thresholds - make the right zone larger and more obvious
          const topThreshold = noteHeight * 0.25; // Top 25% = "Above" zone
          const bottomThreshold = noteHeight * 0.75; // Bottom 25% = "Below" zone
          const rightThreshold = noteWidth * 0.7; // Right 30% = "Inside" zone

          // Get mouse position relative to the note
          const offsetY = clientOffset.y - hoverBoundingRect.top;
          const offsetX = clientOffset.x - hoverBoundingRect.left;

          // Make right zone (Child) stand out to be much more visible for the user
          const isRightZone = offsetX > rightThreshold;
          const isTopZone = offsetY < topThreshold && !isRightZone;
          const isBottomZone = offsetY > bottomThreshold && !isRightZone;

          // Check if in the right side zone (Inside, as a child)
          if (isRightZone) {
            // Add as a child of the current note at the END (Inside)
            moveNote(draggedItemId, note.id, note.children.length);
            
            // Trigger success animation
            const targetElement = document.getElementById(`note-${note.id}`);
            if (targetElement) {
              // Physics animation - expand and then contract with spring physics
              const element = document.getElementById(`note-${note.id}`);
              if (element) {
                const animation = element.animate([
                  { transform: 'scale(1)' },
                  { transform: 'scale(1.05)', boxShadow: '0 0 15px rgba(var(--primary), 0.6)' },
                  { transform: 'scale(1)' }
                ], {
                  duration: 600,
                  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Natural spring physics
                });
              }
            }
          } 
          // Check if in the top zone (Above, same level)
          else if (isTopZone) {
            // Move to the same parent as the current note, but at the current index
            moveNote(draggedItemId, parentId, index);
            
            // Physics animation for top drop 
            const targetArea = document.getElementById(`dropzone-${parentId || 'root'}-${index}`);
            if (targetArea) {
              const animation = targetArea.animate([
                { height: '2px', backgroundColor: 'rgba(var(--primary), 0.5)' },
                { height: '8px', backgroundColor: 'rgba(var(--primary), 0.8)' },
                { height: '2px', backgroundColor: 'rgba(var(--primary), 0.5)' }
              ], {
                duration: 500,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              });
            }
          }
          // Check if in the bottom zone (Below, same level)
          else if (isBottomZone) {
            // Move to the same parent as the current note, but at the next index
            moveNote(draggedItemId, parentId, index + 1);
            
            // Physics animation for bottom drop
            const targetArea = document.getElementById(`dropzone-${parentId || 'root'}-${index + 1}`);
            if (targetArea) {
              const animation = targetArea.animate([
                { height: '2px', backgroundColor: 'rgba(var(--primary), 0.5)' },
                { height: '8px', backgroundColor: 'rgba(var(--primary), 0.8)' },
                { height: '2px', backgroundColor: 'rgba(var(--primary), 0.5)' }
              ], {
                duration: 500,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              });
            }
          }
        }
      }

      // Reset drop target state
      setIsDropTarget(false);
      setDropPosition(null);
    },
    collect: (monitor) => {
      if (!monitor.isOver() || !ref.current) {
        return {
          isOver: false,
          isOverRight: false,
          isOverTop: false,
          isOverBottom: false
        };
      }

      // Get cursor position
      const clientOffset = monitor.getClientOffset();
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      
      if (!clientOffset) {
        return {
          isOver: monitor.isOver(),
          isOverRight: false,
          isOverTop: false,
          isOverBottom: false
        };
      }
      
      // Calculate zones
      const noteHeight = hoverBoundingRect.bottom - hoverBoundingRect.top;
      const noteWidth = hoverBoundingRect.right - hoverBoundingRect.left;
      const offsetY = clientOffset.y - hoverBoundingRect.top;
      const offsetX = clientOffset.x - hoverBoundingRect.left;
      
      // Same threshold calculations as in hover and drop
      const topThreshold = noteHeight * 0.25;
      const bottomThreshold = noteHeight * 0.75;
      const rightThreshold = noteWidth * 0.7;
      
      const isRightZone = offsetX > rightThreshold;
      const isTopZone = offsetY < topThreshold && !isRightZone;
      const isBottomZone = offsetY > bottomThreshold && !isRightZone;
      
      return {
        isOver: monitor.isOver(),
        isOverRight: isRightZone,
        isOverTop: isTopZone,
        isOverBottom: isBottomZone
      };
    },
  });

  // Reset states when a drop is no longer hovering
  useEffect(() => {
    if (!isOver) {
      setIsDropTarget(false);
      setDropPosition(null);
    }
  }, [isOver]);

  // Add child note handler 
  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    addNote(note);
    
    // Auto expand to show the newly added child
    if (!isExpanded) {
      toggleExpand(note.id);
    }
  };

  // Delete note handler
  const handleDeleteNote = () => {
    deleteNote(note.id, deleteChildren);
    setDeleteDialogOpen(false);
  };

  // Start editing handler
  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditContent(note.content);
    setEditTimeSet(note.time_set);
    setEditIsDiscussion(note.is_discussion || false);
    setEditYoutubeUrl(note.youtube_url);
    setEditUrl(note.url);
    setEditUrlDisplayText(note.url_display_text);
    setEditColor(
      typeof note.color === 'number' ? note.color : 
      (note.color ? convertLegacyColorToValue(note.color) : 0)
    );
    
    // Focus the text area after rendering
    setTimeout(() => {
      if (contentEditRef.current) {
        contentEditRef.current.focus();
      }
    }, 50);
  };

  // Save changes handler
  const handleSaveEdit = async () => {
    setIsSaving(true);
    
    try {
      await updateNote({
        ...note,
        content: editContent,
        time_set: editTimeSet,
        is_discussion: editIsDiscussion,
        youtube_url: editYoutubeUrl,
        url: editUrl,
        url_display_text: editUrlDisplayText,
        color: editColor
      });
      
      setIsEditing(false);
    } catch (error) {
      handleToast({
        title: "Error saving note",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
        error: true
      });
      console.error("Error saving note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing handler
  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        await uploadImage(note.id, file);
        toast({
          title: "Image uploaded",
          description: "The image has been added to this note"
        });
      } catch (error) {
        handleToast({
          title: "Error uploading image",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
          error: true
        });
      }
    }
  };

  // Calculate time allocation if this is a timed note
  const timeAllocation = calculateTimeAllocation(note, notes);
  const formattedTimeAllocationText = timeAllocation ? 
    `${timeAllocation.formattedTime} × ${timeAllocation.noteCount} slides` : 
    null;

  // Determine styles based on drag and drop state
  const dropTargetStyles = isDropTarget ? {
    above: dropPosition === 'above' ? 'border-t-2 border-primary' : '',
    below: dropPosition === 'below' ? 'border-b-2 border-primary' : '',
    inside: dropPosition === 'inside' ? 'bg-primary bg-opacity-20' : ''
  } : { above: '', below: '', inside: '' };

  // Framer Motion variants for different states
  const noteVariants = {
    default: {
      scale: 1,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      transition: { duration: 0.2 }
    },
    dragging: {
      scale: 1.03, 
      boxShadow: "0px 8px 20px rgba(0, 0, 0, 0.25)",
      transition: { type: "spring", damping: 25, stiffness: 400 }
    },
    dropTarget: {
      scale: 1.02,
      boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)",
      transition: { type: "spring", damping: 25, stiffness: 400 }
    }
  };

  // Get animation state
  const animationState = isBeingDragged ? "dragging" : (isDropTarget ? "dropTarget" : "default");

  // Combine refs for drag, drop and motion
  const dragDropRef = (el: HTMLDivElement) => {
    drop(el);
    ref.current = el;
  };
  
  return (
    <div className={`mb-1 ${level > 0 ? 'pl-4 sm:pl-6' : ''}`}>
      {/* Dropzone at top level - allows inserting before this note */}
      {!isEditing && <DropZone index={index} parentId={parentId} />}
      
      <motion.div 
        ref={dragDropRef}
        animate={animationState}
        variants={noteVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        id={`note-${note.id}`}
        onClick={(e) => {
          e.stopPropagation();
          selectNote(note);
        }}
        className={cn(
            "note-item note-card border rounded-md p-2 transition flex flex-col gap-1.5 group shadow-sm hover:shadow-md relative",
            selectedNote?.id === note.id ? 'selected-note' : '',
            isEditing ? 'cursor-default' : 'cursor-pointer',
            isOver ? 'z-10' : '',
            isDragging ? 'opacity-50' : 'opacity-100',
            dropTargetStyles.above,
            dropTargetStyles.below,
            dropTargetStyles.inside
        )}
        style={{ 
          ...getNoteBackgroundStyle(note.color),
          x: springX,
          y: springY,
          scale: springScale,
          rotate: springRotate,
          boxShadow
        }}
      >
        {/* Note header with drag handle, expand toggle, and note title */}
        <div className="flex items-start gap-1">
          {/* Drag handle - not shown when editing */}
          {!isEditing && (
            <div 
              ref={drag} 
              className="touch-none cursor-grab active:cursor-grabbing mt-1 text-gray-500 hover:text-primary opacity-30 hover:opacity-100"
            >
              <GripVertical size={16} />
            </div>
          )}
          
          {/* Expand/collapse button - only shown if note has children */}
          {note.children.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="p-1 h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(note.id);
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
          )}
          
          {/* Note content - different display based on editing state */}
          {isEditing ? (
            <div className="flex-1 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              <Textarea
                ref={contentEditRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] text-base"
                placeholder="Note content..."
              />
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-400">Time set</label>
                  <input
                    type="time"
                    value={editTimeSet || ''}
                    onChange={(e) => setEditTimeSet(e.target.value || null)}
                    className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-400">Color</label>
                  <ColorPicker
                    colorValue={editColor}
                    onChange={setEditColor}
                    className="h-8"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-400">Is discussion?</label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editIsDiscussion}
                      onCheckedChange={setEditIsDiscussion}
                    />
                    <span className="text-sm">{editIsDiscussion ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-400">YouTube URL</label>
                <input
                  type="text"
                  value={editYoutubeUrl || ''}
                  onChange={(e) => setEditYoutubeUrl(e.target.value || null)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-400">URL</label>
                  <input
                    type="text"
                    value={editUrl || ''}
                    onChange={(e) => setEditUrl(e.target.value || null)}
                    placeholder="https://example.com"
                    className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-400">URL Display Text</label>
                  <input
                    type="text"
                    value={editUrlDisplayText || ''}
                    onChange={(e) => setEditUrlDisplayText(e.target.value || null)}
                    placeholder="Click here"
                    className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancelEdit}
                  className="h-8"
                >
                  <X size={14} className="mr-1" /> Cancel
                </Button>
                
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="h-8"
                >
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save size={14} className="mr-1" /> Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              {/* Note title */}
              <div className={cn(
                "text-base leading-tight break-words",
                note.is_discussion ? "italic" : "",
                level === 0 ? "heading-h1" : 
                level === 1 ? "heading-h2" : 
                level === 2 ? "heading-h3" : 
                level === 3 ? "heading-h4" : 
                level === 4 ? "heading-h5" : "heading-h6",
              )}>
                {note.content || "Untitled"}
              </div>
              
              {/* Display meta information */}
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                {/* Time information */}
                {note.time_set && (
                  <div className="flex items-center gap-1 bg-gray-800 rounded px-1.5 py-0.5">
                    <Clock size={12} />
                    <span>{note.time_set}</span>
                  </div>
                )}
                
                {/* Time allocation information */}
                {formattedTimeAllocationText && (
                  <div className="flex items-center gap-1 bg-gray-800 rounded px-1.5 py-0.5">
                    <Clock size={12} />
                    <span>{formattedTimeAllocationText}</span>
                  </div>
                )}
                
                {/* Total children count */}
                {note.children.length > 0 && (
                  <div className="flex items-center gap-1 bg-gray-800 rounded px-1.5 py-0.5">
                    <span>{getTotalChildrenCount(note) + 1} slides</span>
                  </div>
                )}
                
                {/* YouTube link */}
                {note.youtube_url && (
                  <a 
                    href={note.youtube_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-red-900/50 text-red-200 rounded px-1.5 py-0.5 hover:bg-red-800/50 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Youtube size={12} />
                    <span>Watch</span>
                  </a>
                )}
                
                {/* External URL */}
                {note.url && (
                  <a 
                    href={note.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-blue-900/50 text-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-800/50 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link size={12} />
                    <span>{note.url_display_text || "Link"}</span>
                  </a>
                )}
                
                {/* Discussion indicator */}
                {note.is_discussion && (
                  <div className="flex items-center gap-1 bg-purple-900/50 text-purple-200 rounded px-1.5 py-0.5">
                    <MessageCircle size={12} />
                    <span>Discussion</span>
                  </div>
                )}
              </div>
              
              {/* Display note images if any */}
              {note.images && note.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <AnimatePresence>
                    {note.images.map((image, idx) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="relative group"
                      >
                        <ImageWithFallback
                          url={image.url}
                          alt={`Image ${idx+1}`}
                          className="w-20 h-20 object-cover rounded-md border border-gray-700"
                        />
                        
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (image.id) removeImage(image.id);
                            }}
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              
              {/* Note action buttons */}
              <div className="flex space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition justify-end">
                {/* Edit button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleStartEditing}
                >
                  <Edit size={14} />
                </Button>
                
                {/* Add child button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleAddChild}
                >
                  <Plus size={14} />
                </Button>
                
                {/* Color picker */}
                <ColorPicker
                  colorValue={
                    typeof note.color === 'number' ? note.color : 
                    (note.color ? convertLegacyColorToValue(note.color) : 0)
                  }
                  onChange={(colorValue) => {
                    updateNote({
                      ...note,
                      color: colorValue
                    });
                  }}
                  className="h-7"
                />
                
                {/* Upload image button */}
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    asChild
                  >
                    <label htmlFor={`image-upload-${note.id}`}>
                      <ImagePlus size={14} />
                    </label>
                  </Button>
                  <input
                    id={`image-upload-${note.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {/* Move button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoveDialogOpen(true);
                  }}
                >
                  <MoveHorizontal size={14} />
                </Button>
                
                {/* Delete button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-950/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Right edge highlight indicator for drop target */}
        <div
          className={cn(
            "absolute top-0 right-0 bottom-0 w-1 opacity-0 transition-all duration-100",
            isOver && isOverRight ? "opacity-100 w-2 bg-primary" : ""
          )}
        />
        
        {/* Children notes - Only render if expanded */}
        <AnimatePresence>
          {isExpanded && note.children.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="mt-2 pl-2 border-l border-gray-700/30"
            >
              {note.children.map((childNote, childIndex) => (
                <AnimatedNoteTreeItem
                  key={childNote.id}
                  note={childNote}
                  level={level + 1}
                  toggleExpand={toggleExpand}
                  isExpanded={expandedNodes.has(childNote.id)}
                  index={childIndex}
                  parentId={note.id}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Dropzone at the end - allows inserting after this note */}
      {!isEditing && <DropZone index={index + 1} parentId={parentId} />}
      
      {/* Delete note confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note?
              {note.children.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium text-red-400">
                    Warning: This note has {note.children.length} child {note.children.length === 1 ? 'note' : 'notes'}.
                  </div>
                  <div className="flex items-center mt-2">
                    <Switch
                      checked={deleteChildren}
                      onCheckedChange={setDeleteChildren}
                      id="delete-children"
                    />
                    <label htmlFor="delete-children" className="ml-2">
                      Delete all child notes as well
                    </label>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNote} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Move note modal */}
      <MoveNoteModal
        isOpen={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        noteToMove={note}
      />
    </div>
  );
}
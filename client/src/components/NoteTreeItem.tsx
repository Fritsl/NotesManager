import { useState, useRef, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Note } from "../types/notes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Plus, 
  Clock, 
  ExternalLink, 
  MessageCircle,
  MoveHorizontal,
  Image,
  Video,
  Link as LinkIcon
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useToast } from "@/hooks/use-toast";
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
import { levelColors } from "@/lib/level-colors";
import { useIsMobile } from "@/hooks/use-mobile";
import MoveNoteModal from "@/components/MoveNoteModal";
import DropZone from "./DropZone";
import { useZenMode } from "@/hooks/useZenMode";

// Calculate total children (direct and nested)
const getTotalChildrenCount = (currentNote: Note): number => {
  let count = 0;
  for (const child of currentNote.children) {
    // Count this child
    count++;
    // Add its children
    count += getTotalChildrenCount(child);
  }
  return count;
};

interface TimeAllocationResult {
  formattedTime: string;
  noteCount: number;
  totalMinutes: number;
}

const calculateTimeAllocation = (currentNote: Note, allNotes: Note[]): TimeAllocationResult | null => {
  // If this note doesn't have time data, we can't calculate allocation
  if (!currentNote.minutes || currentNote.minutes <= 0) {
    return null;
  }
  
  // Get all notes in flat array
  const flatNotes: Note[] = [];
  
  const flattenNotes = (notes: Note[]) => {
    for (const note of notes) {
      flatNotes.push(note);
      if (note.children.length > 0) {
        flattenNotes(note.children);
      }
    }
  };
  
  flattenNotes(allNotes);
  
  // Find the next note with a time value
  const currentNoteIndex = flatNotes.findIndex(note => note.id === currentNote.id);
  
  if (currentNoteIndex === -1) {
    return null;
  }
  
  // Look for the next note with time value
  let nextTimeNoteIndex = -1;
  
  for (let i = currentNoteIndex + 1; i < flatNotes.length; i++) {
    if (flatNotes[i].minutes && flatNotes[i].minutes > 0) {
      // Check if it's not a child of the current note
      if (!isNextNoteDescendant(currentNote, flatNotes[i].id)) {
        nextTimeNoteIndex = i;
        break;
      }
    }
  }
  
  // If no next note with time, just return the current note's time
  if (nextTimeNoteIndex === -1) {
    return {
      formattedTime: `${currentNote.minutes} min`,
      noteCount: 1,
      totalMinutes: currentNote.minutes
    };
  }
  
  // Count notes between current and next timed note
  const noteCount = nextTimeNoteIndex - currentNoteIndex;
  
  // Calculate total minutes
  const totalMinutes = currentNote.minutes;
  
  // Calculate minutes per note
  const minutesPerNote = totalMinutes / noteCount;
  
  const formattedTime = minutesPerNote < 1 
    ? `${Math.round(minutesPerNote * 60)} sec` 
    : `${minutesPerNote.toFixed(1)} min`;
  
  return {
    formattedTime,
    noteCount,
    totalMinutes
  };
};

// Helper function to check if a note is a descendant of another note
const isNextNoteDescendant = (parentNote: Note, targetId: string): boolean => {
  // Check direct children
  for (const child of parentNote.children) {
    if (child.id === targetId) {
      return true;
    }
    
    // Check nested children
    if (isNextNoteDescendant(child, targetId)) {
      return true;
    }
  }
  
  return false;
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

export default function NoteTreeItem({ note, level, toggleExpand, isExpanded, index = 0, isRoot = false, parentId = null }: NoteTreeItemProps) {
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
  const isMobile = useIsMobile(); // Check if we're on a mobile device
  const isZenMode = useZenMode(); // Check if Zen Mode is active

  // References
  const ref = useRef<HTMLDivElement>(null);
  const contentEditRef = useRef<HTMLTextAreaElement>(null);
  const childAreaRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);
  
  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [editMinutes, setEditMinutes] = useState(note.minutes?.toString() || "");
  const [isEditingTime, setIsEditingTime] = useState(false);
  
  // Additional states for new features
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [editUrl, setEditUrl] = useState(note.url || "");
  const [editUrlDisplayText, setEditUrlDisplayText] = useState(note.url_display_text || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const isSelectedNote = selectedNote?.id === note.id;
  
  // Setup react-dnd drag and drop
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: "NOTE",
    item: { 
      type: "NOTE", 
      id: note.id, 
      index, 
      isRoot 
    } as DragItem,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    }),
    canDrag: !isEditing // Prevent dragging when editing
  }));
  
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "NOTE",
    drop: (item: DragItem, monitor) => {
      if (monitor.didDrop()) {
        return; // Don't handle drop events that were already handled by children
      }
      
      if (item.id === note.id) {
        return; // Don't let notes drop onto themselves
      }
      
      // Check if we're dropping a note onto its descendant
      const checkIfDescendant = (node: Note, targetNodeId: string): boolean => {
        if (node.id === targetNodeId) return true;
        for (const child of node.children) {
          if (checkIfDescendant(child, targetNodeId)) return true;
        }
        return false;
      };
      
      const movedNote = notes.find(n => n.id === item.id);
      if (movedNote && checkIfDescendant(movedNote, note.id)) {
        toast({
          title: "Invalid move",
          description: "Cannot move a note into its own descendant",
          variant: "destructive"
        });
        return;
      }
      
      moveNote(item.id, note.id, -1, item.isRoot, parentId);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver({ shallow: true })
    })
  }));
  
  // Handle dropping onto the children area
  const [{ isOverChildArea }, dropChildArea] = useDrop(() => ({
    accept: "NOTE",
    drop: (item: DragItem, monitor) => {
      if (monitor.didDrop()) {
        return; // Don't handle drop events that were already handled by children
      }
      
      if (item.id === note.id) {
        return; // Don't let notes drop onto themselves
      }
      
      // Check if we're dropping a note onto its descendant (we move to the parent in this case)
      const checkIfDescendant = (node: Note, targetNodeId: string): boolean => {
        if (node.id === targetNodeId) return true;
        for (const child of node.children) {
          if (checkIfDescendant(child, targetNodeId)) return true;
        }
        return false;
      };
      
      const movedNote = notes.find(n => n.id === item.id);
      if (movedNote && checkIfDescendant(movedNote, note.id)) {
        toast({
          title: "Invalid move",
          description: "Cannot move a note into its own descendant",
          variant: "destructive"
        });
        return;
      }
      
      moveNote(item.id, note.id, -1, item.isRoot, note.id);
    },
    collect: (monitor) => ({
      isOverChildArea: !!monitor.isOver({ shallow: true })
    })
  }));
  
  // Helper function to format time allocation text
  const formatTimeAllocationText = (note: Note): string => {
    const allocation = calculateTimeAllocation(note, notes);
    if (!allocation) return "";
    
    const { noteCount, totalMinutes, formattedTime } = allocation;
    
    // Format time in hours and minutes
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    
    let timeText = "";
    if (hours > 0) {
      timeText = `${hours} hour${hours !== 1 ? 's' : ''}, `;
    }
    timeText += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    return `${noteCount} slide${noteCount !== 1 ? 's' : ''}, ${timeText} (${formattedTime} per slide)`;
  };

  // Use useEffect to update drag-drop refs when isEditing changes
  useEffect(() => {
    if (!isEditing) {
      // Apply drag-drop capabilities only when not editing
      drag(ref);
      drop(ref);
      preview(ref);
    }
  }, [isEditing, drag, drop, preview]);

  const hasChildren = note.children.length > 0;

  // Display more content in the tree view
  const contentLines = note.content ? note.content.split('\n') : [''];

  // First line is the title (can be a bit longer now)
  // If content is empty, display a placeholder
  const displayContent = note.content.trim() === '' 
    ? '(Empty note)' 
    : contentLines[0].slice(0, 60) + (contentLines[0].length > 60 ? '...' : '');

  return (
    <div className="relative">
      {/* Main note card */}
      <div 
        id={`note-${note.id}`}
        ref={ref}
        className={cn(
          "note-item note-card border rounded-md p-2 transition flex flex-col gap-1.5 group shadow-sm hover:shadow-md relative",
          // Use the level color themes for consistent styling with the header buttons - directly using level index
          level >= 0 && level < levelColors.length ? levelColors[level].bg : levelColors[0].bg,
          `border-l-[5px] ${level >= 0 && level < levelColors.length ? levelColors[level].border : levelColors[0].border}`,
          // Don't highlight the entire note, we'll use a bottom border instead
          selectedNote?.id === note.id ? "selected-note border-primary ring-2 ring-primary ring-opacity-70" : "border-gray-700 hover:bg-opacity-90",
          isDragging && "opacity-50"
        )}
        onClick={() => selectNote(note)}
      >
        {/* Unfold children button in bottom-left corner, far from all delete buttons */}
        {hasChildren && (
          <div className="absolute bottom-1 left-1 z-20">
            <div
              className="flex items-center text-gray-400 hover:text-gray-200 cursor-pointer" 
              title={isExpanded ? "Collapse children" : `Expand ${note.children.length} direct children and ${getTotalChildrenCount(note)} total descendants`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(note.id);
              }}
            >
              <span className="relative flex items-center">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="text-xs text-gray-500 ml-0.5">
                  {note.children.length}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex flex-col gap-1.5">
          {/* Content display - limited in tree view */}
          <div className="text-sm truncate max-w-full font-medium">
            {/* Title from first line, truncated for space */}
            {displayContent}
          </div>
          
          {/* Type icons */}
          <div className="flex items-center space-x-1 text-gray-400">
            {/* Fixed position icons first */}
            {note.is_discussion && <MessageCircle size={14} className="text-blue-400" />}
            {note.url && <LinkIcon size={14} className="text-blue-400" />}
            {note.has_video && <Video size={14} className="text-blue-400" />}
            {note.has_image && <Image size={14} className="text-blue-400" />}
            {note.minutes && note.minutes > 0 && <Clock size={14} className="text-blue-400" />}
          </div>
          
          {/* Time allocation display, if applicable - as its own line for better mobile display */}
          {note.minutes && note.minutes > 0 && (
            <div className="text-xs text-gray-400 truncate max-w-full">
              {formatTimeAllocationText(note)}
            </div>
          )}
          
          {/* Button toolbar at bottom */}
          <div className="flex items-center space-x-1 justify-end">
              {/* Edit Button (always available, even in Zen Mode) */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-blue-500 p-1 touch-target"
                title="Edit Note"
                onClick={(e) => {
                  e.stopPropagation();
                  selectNote(note);
                }}
              >
                <ExternalLink size={16} />
              </Button>

              {/* Add Note Below Button - hidden in zen mode */}
              {!isZenMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-green-500 p-1 touch-target"
                  title="Add Note Below"
                  onClick={(e) => {
                  e.stopPropagation();
                  // Add note in next sibling position
                  if (isRoot) {
                    addNote(null, index + 1);
                  } else {
                    addNote(
                      parentId ? {
                      id: parentId,
                      parent_id: null,
                      content: '',
                      minutes: null,
                      is_discussion: false,
                      has_image: false,
                      has_video: false,
                      url: null,
                      url_display_text: null,
                      children: [] 
                    } as Note : null, index + 1);
                  }
                }}
              >
                <Plus size={16} />
              </Button>
              )}

              {/* Add Child Button - hidden in zen mode */}
              {!isZenMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-indigo-500 p-1 touch-target"
                  title="Add Child"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add note as child of current note, in first position
                    addNote(note, 0);
                    // Auto-expand to show the new child
                    if (!isExpanded) {
                      toggleExpand(note.id);
                    }
                  }}
                >
                  <MoveHorizontal size={16} />
                </Button>
              )}
              
              {/* Spacer div to create distance between Move button and Delete button */}
              <div className="w-2"></div>

              {/* Delete button and dialog - hidden in zen mode */}
              {!isZenMode && (
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 p-1 touch-target"
                      title="Delete Note"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete note{hasChildren ? " and children" : ""}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {hasChildren ? (
                          <>
                            <p>This note has {getTotalChildrenCount(note)} child notes.</p>
                            <div className="mt-4">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={deleteChildren}
                                  onChange={(e) => setDeleteChildren(e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <span>Delete all children (cannot be undone)</span>
                              </label>
                            </div>
                          </>
                        ) : (
                          "This action cannot be undone."
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id, deleteChildren);
                        setDeleteDialogOpen(false);
                      }}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
          </div>
        </div>
      </div>

      {/* Children container */}
      {hasChildren && isExpanded && (
        <div 
          ref={(node) => {
            // Using a callback ref to serve both react-dnd and our own ref
            dropChildArea(node);
            // Safe assignment that avoids the read-only issue
            if (node) {
              (childAreaRef as any).current = node;
            }
          }}
          className={cn(
            "ml-4 mt-1 space-y-1 tree-line relative",
            // Instead of adding borders and padding that cause jumping, just change background color subtly
            isOverChildArea ? "bg-primary/5" : "bg-transparent"
          )}
        >
          {/* Initial drop zone for first position */}
          <DropZone index={0} parentId={note.id} />

          {note.children.map((child, idx) => (
            <div key={child.id}>
              <NoteTreeItem
                note={child}
                level={level + 1}
                index={idx}
                isRoot={false}
                parentId={note.id}
                toggleExpand={toggleExpand}
                isExpanded={expandedNodes.has(child.id)}
              />
              <DropZone index={idx + 1} parentId={note.id} />
            </div>
          ))}

        </div>
      )}

      {/* Move Note Modal */}
      <MoveNoteModal 
        isOpen={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        noteToMove={note}
      />
    </div>
  );
}
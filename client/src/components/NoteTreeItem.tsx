import React, { useRef, useState, useEffect } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Link, Youtube, ArrowDownRightFromCircle, MessageCircle, Clock, MoveHorizontal, Save, Check, Edit, X, Upload, ImagePlus } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { cn } from "@/lib/utils";
import DropZone from "./DropZone";
import { levelColors } from "@/lib/level-colors";
import MoveNoteModal from "./MoveNoteModal";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/useMediaQuery";
import ImageWithFallback from "@/components/ui/image-with-fallback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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

  // References
  const ref = useRef<HTMLDivElement>(null);
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
  const [isSaving, setIsSaving] = useState(false);

  // Set up drag
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'NOTE',
    item: { type: 'NOTE', id: note.id, index, isRoot },
    canDrag: !isEditing, // Disable dragging when editing is active
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

  // Set up drop detection with position information
  const [{ isOver, isOverRight, isOverTop, isOverBottom }, drop] = useDrop<DragItem, void, { isOver: boolean, isOverRight: boolean, isOverTop: boolean, isOverBottom: boolean }>({
    accept: 'NOTE',
    canDrop: () => !isEditing, // Disable dropping when editing is active
    hover: (item, monitor) => {
      // No action needed in hover, we'll just collect position data
    },
    drop: (item, monitor) => {
      if (item.id !== note.id) {
        // Get the dragged note ID
        const draggedItemId = item.id;

        // Don't allow dropping onto self
        if (note.id === draggedItemId) {
          return;
        }

        // Check if source is an ancestor of the target - if so, we can't move (would create a cycle)
        const isSourceAncestorOfTarget = isDescendantOf(draggedItemId, note.id);
        if (isSourceAncestorOfTarget) {
          console.warn("Cannot move a note to one of its own descendants - would create a cycle");
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

          console.log("Drop detected for note:", note.id);
          console.log("Position - X:", offsetX, "Y:", offsetY);
          console.log("Right threshold:", rightThreshold, "offsetX:", offsetX);

          // Make right zone (Child) stand out to be much more visible for the user
          const isRightZone = offsetX > rightThreshold;
          const isTopZone = offsetY < topThreshold && !isRightZone;
          const isBottomZone = offsetY > bottomThreshold && !isRightZone;

          // Check if in the right side zone (Inside, as a child)
          if (isRightZone) {
            console.log("PLACING AS CHILD of", note.id, "at position", note.children.length);
            // Add highlight animation to the target parent note
            const element = document.getElementById(`note-${note.id}`);
            if (element) {
              element.classList.add('note-highlight');
            }
            
            // Add moving animation to the source note
            const sourceElement = document.getElementById(`note-${draggedItemId}`);
            if (sourceElement) {
              sourceElement.classList.add('note-moving');
              setTimeout(() => {
                sourceElement.classList.remove('note-moving');
              }, 1000);
            }
            
            // Very important - Add as a child of the current note at the END (Inside)
            moveNote(draggedItemId, note.id, note.children.length);
            return; // Return to ensure we don't continue to other checks
          } 
          // Check if in the top zone (Above, same level)
          else if (isTopZone) {
            console.log("PLACING ABOVE", note.id, "at position", index);
            
            // Add moving animation to the source note
            const sourceElement = document.getElementById(`note-${draggedItemId}`);
            if (sourceElement) {
              sourceElement.classList.add('note-moving');
              setTimeout(() => {
                sourceElement.classList.remove('note-moving');
              }, 1000);
            }
            
            // For "Above" - place it at the same level (sibling) regardless of original level
            moveNote(draggedItemId, parentId, index);
            return; // Return to ensure we don't continue to other checks
          } 
          // Check if in the bottom zone (Below, same level)
          else if (isBottomZone) {
            console.log("PLACING BELOW", note.id, "at position", index + 1);
            
            // Add moving animation to the source note
            const sourceElement = document.getElementById(`note-${draggedItemId}`);
            if (sourceElement) {
              sourceElement.classList.add('note-moving');
              setTimeout(() => {
                sourceElement.classList.remove('note-moving');
              }, 1000);
            }
            
            // For "Below" - place it at the same level (sibling) regardless of original level
            moveNote(draggedItemId, parentId, index + 1);
            return; // Return to ensure we don't continue to other checks
          }
          // Middle area (default to below)
          else {
            console.log("PLACING IN MIDDLE ZONE (as below)", note.id, "at position", index + 1);
            // Default to below for the middle area
            moveNote(draggedItemId, parentId, index + 1);
            return; // Return to ensure we don't continue to other checks
          }
        }
      }
    },
    collect: (monitor) => {
      // Check if currently dragging over this note
      const isOver = monitor.isOver({ shallow: true });

      // Determine which drop zone we're in
      let isOverRight = false;  // Inside
      let isOverTop = false;    // Above 
      let isOverBottom = false; // Below

      if (isOver && ref.current) {
        const clientOffset = monitor.getClientOffset();
        const hoverBoundingRect = ref.current.getBoundingClientRect();

        if (clientOffset) {
          const noteHeight = hoverBoundingRect.bottom - hoverBoundingRect.top;
          const noteWidth = hoverBoundingRect.right - hoverBoundingRect.left;

          // Calculate mouse position relative to note
          const offsetX = clientOffset.x - hoverBoundingRect.left;
          const offsetY = clientOffset.y - hoverBoundingRect.top;

          // Calculate thresholds
          const topThreshold = noteHeight * 0.25;
          const bottomThreshold = noteHeight * 0.75;
          const rightThreshold = noteWidth * 0.7;

          // Determine which zone we're in
          isOverRight = offsetX > rightThreshold;
          isOverTop = offsetY < topThreshold && !isOverRight;
          isOverBottom = offsetY > bottomThreshold && !isOverRight;
        }
      }

      return {
        isOver,
        isOverRight,
        isOverTop,
        isOverBottom
      };
    },
  });

  // Create a ref for the child area
  const childAreaRef = useRef<HTMLDivElement>(null);

  // Set up child area drop
  const [{ isOverChildArea }, dropChildArea] = useDrop<DragItem, void, { isOverChildArea: boolean }>({
    accept: 'NOTE',
    canDrop: () => !isEditing, // Disable dropping when editing is active
    drop: (item, monitor) => {
      if (item.id !== note.id) {
        const draggedItemId = item.id;

        // Don't allow dropping onto self
        if (note.id === draggedItemId) {
          return;
        }

        // Check if source is an ancestor of the target - if so, we can't move (would create a cycle)
        const isSourceAncestorOfTarget = isDescendantOf(draggedItemId, note.id);
        if (isSourceAncestorOfTarget) {
          console.warn("Cannot move a note to one of its own descendants - would create a cycle");
          return;
        }

        console.log("DROP IN CHILD AREA: Adding as child of", note.id);

        // Get the client offset to determine drop position
        const clientOffset = monitor.getClientOffset();

        // Add animation to highlight the target note
        const targetElement = document.getElementById(`note-${note.id}`);
        if (targetElement) {
          targetElement.classList.add('note-highlight');
        }
        
        // Add moving animation to the source note
        const sourceElement = document.getElementById(`note-${draggedItemId}`);
        if (sourceElement) {
          sourceElement.classList.add('note-moving');
          setTimeout(() => {
            sourceElement.classList.remove('note-moving');
          }, 1000);
        }
        
        // When dropping directly in the child area (not on a specific child),
        // We now ALWAYS add it at the END of the children list
        moveNote(draggedItemId, note.id, note.children.length);
      }
    },
    collect: (monitor) => ({
      isOverChildArea: monitor.isOver(),
    }),
  });

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

  // Get multiple lines for preview if available
  const MAX_PREVIEW_LINES = 3;
  const previewLines = contentLines.slice(1, MAX_PREVIEW_LINES + 1).map(line => 
    line.slice(0, 60) + (line.length > 60 ? '...' : '')
  );

  // Check if there are more lines beyond what we're showing
  const hasMoreLines = contentLines.length > MAX_PREVIEW_LINES + 1;

  // Add handler for starting edit mode
  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    // No need to set content state as we're using uncontrolled components
    // Initialize other form fields
    setEditTimeSet(note.time_set);
    setEditIsDiscussion(note.is_discussion);
    setEditYoutubeUrl(note.youtube_url);
    setEditUrl(note.url);
    setEditUrlDisplayText(note.url_display_text);
    selectNote(note); // Select the note when editing
  };

  // Update the local state whenever the note changes (from other components)
  // Only update other fields, but not content since we're using uncontrolled component for textarea
  useEffect(() => {
    // Note: don't update editContent as it would conflict with our uncontrolled textarea
    setEditTimeSet(note.time_set);
    setEditIsDiscussion(note.is_discussion);
    setEditYoutubeUrl(note.youtube_url);
    setEditUrl(note.url);
    setEditUrlDisplayText(note.url_display_text);
  }, [
    // note.content, - removed to prevent controlled/uncontrolled conflict
    note.time_set,
    note.is_discussion,
    note.youtube_url, 
    note.url, 
    note.url_display_text
  ]);

  // Focus the textarea when entering edit mode
  useEffect(() => {
    if (isEditing && contentEditRef.current) {
      contentEditRef.current.focus();
    }
  }, [isEditing]);

  // Define common save and cancel functions for both mobile and desktop editing
  const handleSaveNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);

    try {
      // Get content directly from the textarea ref to avoid cursor jump issues
      const currentContent = contentEditRef.current?.value || note.content;

      // Update the note in memory with all properties
      const updatedNote = {
        ...note,
        content: currentContent,
        time_set: editTimeSet,
        is_discussion: editIsDiscussion,
        youtube_url: editYoutubeUrl,
        url: editUrl,
        url_display_text: editUrlDisplayText
      };

      // First update in local state
      updateNote(updatedNote);

      // Then save to server
      await saveProject();

      toast({
        title: "Note Updated",
        description: "Changes have been saved",
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Save Failed",
        description: "Could not save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    // Reset all edit states, except for content which is handled by the uncontrolled component
    // No need to update editContent since we'll reset the defaultValue when we reopen the editor
    setEditTimeSet(note.time_set);
    setEditIsDiscussion(note.is_discussion);
    setEditYoutubeUrl(note.youtube_url);
    setEditUrl(note.url);
    setEditUrlDisplayText(note.url_display_text);
  };

  // Create edit form content that will be used in both mobile dialog and inline editing
  const renderEditForm = () => (
    <>
      {/* Content editor with more height - Using completely uncontrolled component */}
      <Textarea 
        ref={contentEditRef}
        rows={Math.min(isMobile ? 3 : 6, note.content.split('\n').length + 1)}
        className={cn(
          "w-full p-2 text-sm bg-gray-850 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary resize-none mb-3",
          isMobile && "min-h-[4.5rem]" // Shorter textarea on mobile (3 lines)
        )}
        placeholder="Enter note content..."
        defaultValue={note.content} // Initialize with note content, but don't update during typing
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        // No autoFocus attribute to prevent stealing focus from other fields
      />

      {/* Images Section */}
      <div className="mt-2 mb-4 border-t border-gray-700 pt-2">
        <div className="text-xs text-gray-400 flex justify-between items-center mb-2">
          <span>Images</span>
          <label 
            htmlFor={`image-upload-${note.id}`} 
            className="inline-flex items-center text-primary hover:text-primary-hover cursor-pointer text-xs"
          >
            <ImagePlus size={14} className="mr-1" />
            <span>Add Image</span>
            <input
              id={`image-upload-${note.id}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                const file = files[0];
                if (!file.type.startsWith('image/')) {
                  console.log("Invalid file type:", file.type);
                  return;
                }

                // Check file size (limit to 5MB)
                if (file.size > 5 * 1024 * 1024) {
                  console.log("File too large:", file.size);
                  return;
                }

                try {
                  // Show loading state
                  setIsSaving(true);
                  
                  // Upload the image
                  const image = await uploadImage(note.id, file);

                  if (image) {
                    // Reset the file input
                    e.target.value = '';
                    
                    // Update the note with the new image
                    const existingImages = note.images || [];
                    const updatedNote = {
                      ...note,
                      images: [...existingImages, image]
                    };
                    
                    // Update the note in state
                    updateNote(updatedNote);
                    
                    // Make sure the changes are saved to the server
                    await saveProject();
                  }
                } catch (error) {
                  console.error('Error uploading image:', error);
                } finally {
                  setIsSaving(false);
                }
              }}
            />
          </label>
        </div>

        {/* Display images if any */}
        {note.images && note.images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {/* Deduplicate images by converting to a Map using ID as key, then back to array */}
            {Array.from(
              // Create a Map with image ID as key to eliminate duplicates
              new Map(
                note.images.map(img => [img.id, img])
              ).values()
            )
            // Sort by position after deduplication
            .sort((a, b) => a.position - b.position)
            .map((image) => (
              <div 
                key={`image-${image.id}`} 
                className="relative group border border-gray-800 rounded-md overflow-hidden"
              >
                <ImageWithFallback 
                  url={image.url} 
                  alt="Note attachment" 
                  className="w-full h-auto object-cover cursor-pointer"
                />
                <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                  {/* Remove image button */}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 bg-red-900/80 hover:bg-red-800 rounded-full"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        setIsSaving(true);
                        // Ensure image.id is defined before trying to remove it
                        if (!image.id) {
                          console.error('Cannot remove image: image ID is undefined');
                          return;
                        }
                        const success = await removeImage(image.id);
                        if (success) {
                          // Update the note in state to remove the image
                          const updatedImages = note.images?.filter(img => img.id !== image.id) || [];
                          const updatedNote = { ...note, images: updatedImages };
                          updateNote(updatedNote);
                          // Save to server
                          await saveProject();
                        }
                      } catch (error) {
                        console.error('Error removing image:', error);
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                  >
                    <X size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Properties section (compact, single-line items) */}
      <div className={cn(
        "grid gap-x-4 gap-y-2 mb-3",
        isMobile ? "grid-cols-1" : "grid-cols-2" // Single column on mobile for more space
      )}>
        {/* Time settings with enhanced focus handling */}
        <div className="flex items-center">
          <label className="text-xs text-gray-400 w-14" htmlFor={`time-${note.id}`}>Time:</label>
          <input 
            id={`time-${note.id}`}
            type="time" 
            className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
            value={editTimeSet || ''}
            onChange={(e) => {
              e.preventDefault(); 
              e.stopPropagation();
              
              // Use a separate variable to track state change
              const newValue = e.target.value ? e.target.value : null;
              setEditTimeSet(newValue);
              
              // Mark this field as the active one
              document.body.dataset.activeField = `time-${note.id}`;
              
              // Store this input's ID as the last focused element
              setLastFocusedElementId(`time-${note.id}`);
            }}
            onKeyDown={(e) => {
              // Don't let the event bubble up to potentially interfere with focus
              e.stopPropagation();
            }}
            onFocus={(e) => {
              e.stopPropagation();
              // Mark active to prevent other elements from stealing focus
              document.body.dataset.activeField = `time-${note.id}`;
              setLastFocusedElementId(e.target.id);
            }}
            onBlur={(e) => {
              // Only clear if this is the current active field
              if (document.body.dataset.activeField === `time-${note.id}`) {
                document.body.dataset.activeField = '';
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Discussion toggle */}
        <div className="flex items-center">
          <label className="text-xs text-gray-400 w-20">Discussion:</label>
          <Switch 
            checked={editIsDiscussion} 
            onCheckedChange={setEditIsDiscussion}
            className="ml-1 data-[state=checked]:bg-blue-600"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Test field with dedicated focus management */}
        <div className="p-2 mb-2 bg-blue-900/30 border border-blue-500 rounded">
          <div className="text-xs text-blue-300 mb-2 text-center">Test Field (Try editing this one first)</div>
          <input 
            id={`test-field-${note.id}`}
            type="text" 
            className="w-full h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
            placeholder="Test field with standalone focus handling..."
            defaultValue="Type here to test focus"
            onClick={(e) => {
              e.stopPropagation();
              // Mark active to prevent other elements from stealing focus
              document.body.dataset.activeFocus = `test-field-${note.id}`;
            }}
            onFocus={(e) => {
              e.stopPropagation();
              setLastFocusedElementId(e.target.id);
              // Mark this field as currently focused
              document.body.dataset.activeFocus = e.target.id;
            }}
            onBlur={() => {
              // Clear active focus marker when field loses focus
              if (document.body.dataset.activeFocus === `test-field-${note.id}`) {
                document.body.dataset.activeFocus = '';
              }
            }}
          />
        </div>
        
        {/* YouTube URL with enhanced focus handling */}
        <div className="flex items-center col-span-full">
          <label className="text-xs text-gray-400 w-20" htmlFor={`youtube-${note.id}`}>YouTube:</label>
          <input 
            id={`youtube-${note.id}`}
            type="url" 
            className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
            placeholder="https://youtube.com/watch?v=..."
            value={editYoutubeUrl || ''}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Use a separate variable to track state change
              const newValue = e.target.value || null;
              setEditYoutubeUrl(newValue);
              
              // Mark this field as the active one
              document.body.dataset.activeField = `youtube-${note.id}`;
              
              // Store this input's ID as the last focused element
              setLastFocusedElementId(`youtube-${note.id}`);
            }}
            onKeyDown={(e) => {
              // Don't let the event bubble up to potentially interfere with focus
              e.stopPropagation();
            }}
            onFocus={(e) => {
              e.stopPropagation();
              // Mark active to prevent other elements from stealing focus
              document.body.dataset.activeField = `youtube-${note.id}`;
              setLastFocusedElementId(e.target.id);
            }}
            onBlur={(e) => {
              // Only clear if this is the current active field
              if (document.body.dataset.activeField === `youtube-${note.id}`) {
                document.body.dataset.activeField = '';
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* External URL with enhanced focus handling */}
        <div className="flex items-center col-span-full">
          <label className="text-xs text-gray-400 w-20" htmlFor={`url-${note.id}`}>URL:</label>
          <input 
            id={`url-${note.id}`}
            type="url" 
            className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
            placeholder="https://..."
            value={editUrl || ''}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Use a separate variable to track state change
              const newValue = e.target.value || null;
              setEditUrl(newValue);
              
              // Mark this field as the active one
              document.body.dataset.activeField = `url-${note.id}`;
              
              // Store this input's ID as the last focused element
              setLastFocusedElementId(`url-${note.id}`);
            }}
            onKeyDown={(e) => {
              // Don't let the event bubble up to potentially interfere with focus
              e.stopPropagation();
            }}
            onFocus={(e) => {
              e.stopPropagation();
              // Mark active to prevent other elements from stealing focus
              document.body.dataset.activeField = `url-${note.id}`;
              setLastFocusedElementId(e.target.id);
            }}
            onBlur={(e) => {
              // Only clear if this is the current active field
              if (document.body.dataset.activeField === `url-${note.id}`) {
                document.body.dataset.activeField = '';
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* URL Display Text with enhanced focus handling */}
        <div className="flex items-center col-span-full">
          <label className="text-xs text-gray-400 w-20" htmlFor={`url-text-${note.id}`}>Link text:</label>
          <input 
            id={`url-text-${note.id}`}
            type="text" 
            className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
            placeholder="Display text for URL..."
            value={editUrlDisplayText || ''}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Use a separate variable to track state change
              const newValue = e.target.value || null;
              setEditUrlDisplayText(newValue);
              
              // Mark this field as the active one
              document.body.dataset.activeField = `url-text-${note.id}`;
              
              // Store this input's ID as the last focused element
              setLastFocusedElementId(`url-text-${note.id}`);
            }}
            onKeyDown={(e) => {
              // Don't let the event bubble up to potentially interfere with focus
              e.stopPropagation();
            }}
            onFocus={(e) => {
              e.stopPropagation();
              // Mark active to prevent other elements from stealing focus
              document.body.dataset.activeField = `url-text-${note.id}`;
              setLastFocusedElementId(e.target.id);
            }}
            onBlur={(e) => {
              // Only clear if this is the current active field
              if (document.body.dataset.activeField === `url-text-${note.id}`) {
                document.body.dataset.activeField = '';
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </>
  );

  // Track the last focused element in the mobile dialog to restore focus after state updates
  const [lastFocusedElementId, setLastFocusedElementId] = React.useState<string | null>(null);
  
  // Use effect to maintain focus on the last focused input
  React.useEffect(() => {
    if (isEditing && isMobile && lastFocusedElementId) {
      const element = document.getElementById(lastFocusedElementId);
      if (element) {
        // Add a small delay to ensure the focus happens after React's rendering
        setTimeout(() => {
          // Set caret position to the end of the text for text inputs
          if (element instanceof HTMLInputElement && element.type !== 'time') {
            const valueLength = element.value.length;
            element.setSelectionRange(valueLength, valueLength);
          }
          
          // Focus the element
          element.focus();
        }, 50); // Increased delay for more reliable focus restoration
      }
    }
  }, [isEditing, isMobile, lastFocusedElementId, editTimeSet, editYoutubeUrl, editUrl, editUrlDisplayText]);

  // Mobile Dialog for fullscreen editing
  const MobileEditDialog = () => (
    <Dialog open={isEditing && isMobile} onOpenChange={(open) => {
      if (!open) setIsEditing(false);
    }}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto top-[5%] translate-y-0">
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            Edit note details
          </DialogDescription>
        </DialogHeader>
        <div 
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => {
            // Check if the focused element is one of our inputs and has an ID
            if (e.target.tagName === 'INPUT' && e.target.id) {
              setLastFocusedElementId(e.target.id);
            }
          }}
        >
          {renderEditForm()}
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button
            size="sm"
            className="h-9 px-4"
            onClick={handleSaveNote}
            disabled={isSaving}
          >
            {isSaving ? (
              <>Loading...</>
            ) : (
              <>
                <Check size={16} className="mr-1" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="note-tree-item">
      {/* Mobile fullscreen edit dialog */}
      {isMobile && <MobileEditDialog />}

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
          {/* Drop zone indicators */}

          {/* "Above" drop zone indicator - top border */}
          {isOver && isOverTop && (
            <div className="absolute left-0 top-0 right-0 h-1 bg-primary"></div>
          )}

          {/* "Below" drop zone indicator - bottom border */}
          {isOver && isOverBottom && (
            <div className="absolute left-0 bottom-0 right-0 h-1 bg-primary"></div>
          )}

          {/* "Inside" drop zone indicator - right edge */}
          <div className={cn(
            "absolute top-0 right-0 bottom-0 w-1 opacity-0 transition-all duration-100",
            // Only show when hovering over the note (not dragging)
            "group-hover:opacity-10", 
            // Highlight when dragging over right side - Make it MUCH more obvious
            isOver && isOverRight && "bg-primary opacity-80 w-4"
          )}></div>

          <div className="flex-1 overflow-hidden">
            {isEditing && !isMobile ? (
              /* Inline Edit Mode - Only shown on desktop; mobile uses fullscreen dialog */
              <div className="w-full" onClick={(e) => e.stopPropagation()}>
                {/* Content editor with more height */}
                <Textarea 
                  ref={contentEditRef}
                  rows={Math.min(isMobile ? 10 : 6, note.content.split('\n').length + 1)}
                  className={`w-full p-2 text-sm bg-gray-850 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary resize-none mb-3 ${
                    isMobile && "h-48 min-h-[8rem]" // Taller textarea on mobile
                  }`}
                  placeholder="Enter note content..."
                  defaultValue={note.content} // Initialize with note content, but don't track changes
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  // Removed autoFocus to prevent it from stealing focus from other fields
                />

                {/* Properties section (compact, single-line items) */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                  {/* Time settings */}
                  <div className="flex items-center">
                    <label className="text-xs text-gray-400 w-14" htmlFor={`desktop-time-${note.id}`}>Time:</label>
                    <input 
                      id={`desktop-time-${note.id}`}
                      type="time" 
                      className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                      value={editTimeSet || ''}
                      onChange={(e) => setEditTimeSet(e.target.value ? e.target.value : null)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Discussion toggle */}
                  <div className="flex items-center">
                    <label className="text-xs text-gray-400 w-20">Discussion:</label>
                    <Switch 
                      checked={editIsDiscussion} 
                      onCheckedChange={setEditIsDiscussion}
                      className="ml-1 data-[state=checked]:bg-blue-600"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* YouTube URL */}
                  <div className="flex items-center col-span-2">
                    <label className="text-xs text-gray-400 w-20" htmlFor={`desktop-youtube-${note.id}`}>YouTube:</label>
                    <input 
                      id={`desktop-youtube-${note.id}`}
                      type="url" 
                      className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                      placeholder="https://youtube.com/watch?v=..."
                      value={editYoutubeUrl || ''}
                      onChange={(e) => setEditYoutubeUrl(e.target.value || null)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* External URL */}
                  <div className="flex items-center col-span-2">
                    <label className="text-xs text-gray-400 w-20" htmlFor={`desktop-url-${note.id}`}>URL:</label>
                    <input 
                      id={`desktop-url-${note.id}`}
                      type="url" 
                      className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                      placeholder="https://..."
                      value={editUrl || ''}
                      onChange={(e) => setEditUrl(e.target.value || null)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Display text (only if URL exists) */}
                  {editUrl && (
                    <div className="flex items-center col-span-2">
                      <label className="text-xs text-gray-400 w-20" htmlFor={`desktop-url-text-${note.id}`}>Link text:</label>
                      <input 
                        id={`desktop-url-text-${note.id}`}
                        type="text" 
                        className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                        placeholder="Link display text"
                        value={editUrlDisplayText || ''}
                        onChange={(e) => setEditUrlDisplayText(e.target.value || null)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>

                {/* Images section */}
                {note.images && note.images.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-1">Images:</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {note.images.map((image, idx) => (
                        <div key={image.id} className="relative group border border-gray-700 rounded overflow-hidden flex-shrink-0" style={{width: '80px', height: '60px'}}>
                          {/* Image with improved error handling fallback */}
                          {image.url ? (
                            <div className="w-full h-full relative">
                              <ImageWithFallback 
                                url={image.url} 
                                alt="Note attachment" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            // Fallback for missing URL
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                                <circle cx="12" cy="13" r="3"></circle>
                              </svg>
                            </div>
                          )}

                          {/* Control buttons - always visible on hover */}
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={async () => {
                                try {
                                  setIsSaving(true);
                                  const success = await removeImage(image.id || '');
                                  if (success) {
                                    toast({
                                      title: "Image Removed",
                                      description: "Image has been removed from the note",
                                    });

                                    // First update the note in local state
                                    const updatedNote = {
                                      ...note,
                                      images: (note.images || []).filter(img => img.id !== image.id)
                                    };
                                    updateNote(updatedNote);

                                    // Then save the project to ensure changes are synced
                                    await saveProject();
                                  }
                                } catch (err) {
                                  console.error("Failed to remove image:", err);
                                  toast({
                                    title: "Remove Failed",
                                    description: "Could not remove image. Please try again.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add images button */}<div className="flex items-center mb-3">
                  <input 
                    type="file" 
                    id={`file-upload-${note.id}`} 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setIsSaving(true); // Show loading state
                          const result = await uploadImage(note.id, file);
                          if (result) {
                            toast({
                              title: "Image Uploaded",
                              description: "Image has been added to the note",
                            });

                            // Ensure the note has an images array
                            const existingImages = note.images || [];

                            // Create updated note with the new image properly integrated
                            const updatedNote = {
                              ...note,
                              images: [...existingImages, result]                            };

                            // First update the note in the state
                            updateNote(updatedNote);

                            //                            // Then save the project to ensure images are synced with server
                            await saveProject();
                          }
                          // Clear the input afterupload
                          e.target.value = '';
                        } catch (err) {
                          console.error("Failed to upload image:", err);
                          toast({
                            title: "Upload Failed",
                            description: "Could not upload image. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSaving(false);
                        }
                      }
                    }}
                  />
                  <label htmlFor={`file-upload-${note.id}`} className="cursor-pointer flex items-center text-xs text-gray-400 hover:text-gray-300">
                    <Upload className="h-3 w-3 mr-1" />
                    Add Image
                  </label>
                </div>

                {/* Action buttons */}
                <div className="flex space-x-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={handleCancelEdit}
                  >
                    <X size={14} className="mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleSaveNote}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="animate-pulse">Saving...</span>
                    ) : (
                      <>
                        <Check size={14} className="mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal Display Mode */
              <>
                {/* Title line - larger and more prominent */}
                <div className="flex flex-col gap-2">
                  <div 
                    className="truncate"
                    style={{
                      fontSize: level === 0 ? '24px' : 
                               level === 1 ? '20px' : 
                               level === 2 ? '18px' : 
                               level === 3 ? '16px' : 
                               level === 4 ? '14px' : '13px',
                      fontWeight: level === 0 ? 700 : 
                                level === 1 ? 600 : 
                                level === 2 ? 400 : /* L2 (level 2) now non-bold */
                                level === 3 ? 500 : 
                                level === 4 ? 500 : 400,
                      fontStyle: level === 2 ? 'italic' : 'normal', /* L2 (level 2) now italic */
                      lineHeight: level === 0 ? 1.2 : 
                                 level === 1 ? 1.3 : 
                                 level === 2 ? 1.35 : 
                                 level === 3 ? 1.4 : 1.5,
                      color: level === 0 ? 'rgba(255, 255, 255, 0.95)' : 
                            level === 1 ? 'rgba(255, 255, 255, 0.9)' : 
                            level === 2 ? 'rgba(255, 255, 255, 0.85)' : 
                            level === 3 ? 'rgba(255, 255, 255, 0.8)' : 
                            level === 4 ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.7)'
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                      // Select the note as well
                      selectNote(note);
                    }}
                  >
                    {displayContent}
                  </div>
                  {/* All tools aligned right */}
                  <div className="flex items-center gap-2 justify-end">
                    {/* Discussion icon and unfold button */}
                    <div className="flex items-center gap-2">
                      {note.is_discussion && (
                        <span className="text-blue-400 shrink-0" title="Discussion">
                          <MessageCircle size={16} />
                        </span>
                      )}
                      {note.youtube_url && (
                        <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">YouTube</span>
                      )}
                      {note.url && (
                        <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">Link</span>
                      )}
                    </div>
                    {hasChildren && (
                      <Button
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 min-w-[1.5rem] p-0 flex items-center justify-center text-gray-500 hover:text-gray-700 touch-target"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(note.id);
                        }}
                      >
                        {isExpanded 
                          ? <ChevronDown size={16} /> 
                          : <div className="flex items-center">
                              <ChevronRight size={16} />
                              {note.children.length > 0 && (
                                <span className="ml-1 text-xs text-gray-400 font-mono">{note.children.length}</span>
                              )}
                            </div>
                        }
                      </Button>
                    )}
                  </div>
                </div>

                {/* Multiple preview lines */}
                {previewLines.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {previewLines.map((line, index) => (
                      <div 
                        key={index} 
                        className="text-xs text-gray-400 truncate leading-snug"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setIsEditing(true);
                          // Select the note as well 
                          selectNote(note);
                        }}
                      >
                        {line}
                      </div>
                    ))}
                    {hasMoreLines && (
                      <div className="text-xs text-gray-500 italic">more...</div>
                    )}
                  </div>
                )}


              </>
            )}
          </div>

          {/* Action buttons - below text on mobile, hover on desktop */}
          <div className="flex space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition justify-end">
            {/* Edit Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-green-500 p-1 touch-target"
              title="Edit Note"
              onClick={startEditing}
              disabled={isEditing}
            >
              <Edit size={16} />
            </Button>

            {/* Add Note Below Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-green-500 p-1 touch-target"
              title="Add Note Below"
              onClick={(e) => {
                e.stopPropagation();
                // If it's a root note, create another root note
                if (isRoot) {
                  // Create a root note at the current index + 1 (directly below this note)
                  addNote(null, index + 1);
                } else {
                  // Create a sibling right after the current note (at index + 1)
                  addNote(parentId ? { 
                    id: parentId, 
                    content: "", 
                    position: index + 1, // Place after current note
                    is_discussion: false,
                    time_set: null,
                    youtube_url: null,
                    url: null,
                    url_display_text: null,
                    children: [] 
                  } as Note : null, index + 1);
                }
              }}
            >
              <Plus size={16} />
            </Button>

            {/* Add Child Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-indigo-500 p-1 touch-target"
              title="Add Child"
              onClick={(e) => {
                e.stopPropagation();
                // Create a child note
                addNote(note);
              }}
            >
              <ArrowDownRightFromCircle size={16} />
            </Button>

            {/* Move Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-amber-500 p-1 touch-target"
              title="Move Note"
              onClick={(e) => {
                e.stopPropagation();
                setMoveDialogOpen(true);
              }}
            >
              <MoveHorizontal size={16} />
            </Button>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-500 p-1 touch-target"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteChildren(false); // Reset checkbox to unchecked by default
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Note</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this note?
                    {hasChildren && (
                      <>
                        <div className="flex items-center mt-4 mb-2">
                          <input 
                            type="checkbox" 
                            id="delete-children-checkbox"
                            checked={deleteChildren} 
                            onChange={(e) => setDeleteChildren(e.target.checked)} 
                            className="form-checkbox h-4 w-4 mr-2 rounded border-gray-300 focus:ring-primary"
                          />
                          <label htmlFor="delete-children-checkbox" className="text-sm">
                            Also delete children ({note.children.length} note{note.children.length !== 1 ? 's' : ''})
                          </label>
                        </div>
                        {!deleteChildren && (
                          <span className="text-sm text-gray-300 block mb-2">
                            Children will be moved to the same level as this note
                          </span>
                        )}
                        {deleteChildren && (
                          <span className="font-medium text-red-500 block mb-2">
                            Warning: This will permanently delete all child notes!
                          </span>
                        )}
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteNote(note.id, deleteChildren)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
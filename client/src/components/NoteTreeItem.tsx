import { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Link, Youtube, ArrowDownRightFromCircle, MessageCircle, Clock, MoveHorizontal } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { cn } from "@/lib/utils";
import DropZone from "./DropZone";
import { levelColors } from "@/lib/level-colors";
import MoveNoteModal from "./MoveNoteModal";
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
  const { selectedNote, selectNote, addNote, deleteNote, moveNote, expandedNodes, notes } = useNotes();
  const ref = useRef<HTMLDivElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Set up drag
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'NOTE',
    item: { type: 'NOTE', id: note.id, index, isRoot },
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
            // Very important - Add as a child of the current note at the END (Inside)
            moveNote(draggedItemId, note.id, note.children.length);
            return; // Return to ensure we don't continue to other checks
          } 
          // Check if in the top zone (Above, same level)
          else if (isTopZone) {
            console.log("PLACING ABOVE", note.id, "at position", index);
            // For "Above" - place it at the same level (sibling) regardless of original level
            moveNote(draggedItemId, parentId, index);
            return; // Return to ensure we don't continue to other checks
          } 
          // Check if in the bottom zone (Below, same level)
          else if (isBottomZone) {
            console.log("PLACING BELOW", note.id, "at position", index + 1);
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
        
        // When dropping directly in the child area (not on a specific child),
        // We now ALWAYS add it at the END of the children list
        moveNote(draggedItemId, note.id, note.children.length);
      }
    },
    collect: (monitor) => ({
      isOverChildArea: monitor.isOver(),
    }),
  });

  // Connect drag and drop refs
  drag(ref);
  drop(preview(ref));

  const hasChildren = note.children.length > 0;

  // Display more content in the tree view
  const contentLines = note.content.split('\n');
  
  // First line is the title (can be a bit longer now)
  const displayContent = contentLines[0].slice(0, 60) + (contentLines[0].length > 60 ? '...' : '');
  
  // Get multiple lines for preview if available
  const MAX_PREVIEW_LINES = 3;
  const previewLines = contentLines.slice(1, MAX_PREVIEW_LINES + 1).map(line => 
    line.slice(0, 60) + (line.length > 60 ? '...' : '')
  );
  
  // Check if there are more lines beyond what we're showing
  const hasMoreLines = contentLines.length > MAX_PREVIEW_LINES + 1;

  return (
    <div className="note-tree-item">
      <div className="relative">
        {/* Main note card */}
        <div 
          ref={ref}
          className={cn(
            "note-item note-card border rounded-md p-2 sm:p-2 transition flex items-start group shadow-sm hover:shadow-md relative",
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
          
          {/* Drag handle - larger touch target on mobile */}
          <div className="drag-handle mr-1 sm:mr-2 text-gray-400 hover:text-gray-600 cursor-grab touch-target flex items-center justify-center">
            <GripVertical size={16} />
          </div>
          
          {hasChildren ? (
            <Button
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 min-w-[1.5rem] p-0 mr-1 flex items-center justify-center text-gray-500 hover:text-gray-700 touch-target"
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
          ) : (
            <div className="w-[1.5rem] mr-1"></div>
          )}
          
          <div className="flex-1 overflow-hidden">
            {/* Title line - larger and more prominent */}
            <div className="flex items-center">
              <div className={`mobile-text-base font-medium ${level >= 0 && level < levelColors.length ? levelColors[level].text : levelColors[0].text} truncate flex-1`}>
                {displayContent}
              </div>
              {note.is_discussion && (
                <span className="ml-2 text-blue-400 shrink-0" title="Discussion">
                  <MessageCircle size={16} />
                </span>
              )}
            </div>
            
            {/* Multiple preview lines */}
            {previewLines.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {previewLines.map((line, index) => (
                  <div key={index} className="text-xs text-gray-400 truncate leading-snug">{line}</div>
                ))}
                {hasMoreLines && (
                  <div className="text-xs text-gray-500 italic">more...</div>
                )}
              </div>
            )}
            
            {/* Badges for special attributes */}
            {(note.youtube_url || note.url || note.time_set) && (
              <div className="flex flex-wrap gap-2 mt-1">
                {note.youtube_url && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-950 text-white border border-red-700 shadow-sm">
                    <Youtube size={12} className="mr-1" />
                    YouTube
                  </span>
                )}
                
                {note.url && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-950 text-white border border-blue-700 shadow-sm">
                    <Link size={12} className="mr-1" />
                    {note.url_display_text || "Link"}
                  </span>
                )}
                
                {note.time_set && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-950 text-white border border-purple-700 shadow-sm">
                    <Clock size={12} className="mr-1" />
                    {note.time_set.includes(':') ? note.time_set.split(':').slice(0, 2).join(':') : note.time_set}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Action buttons - always visible on mobile, larger touch targets */}
          <div className="flex space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition">
            {/* Add Sibling Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-primary p-1 touch-target"
              title="Add Sibling"
              onClick={(e) => {
                e.stopPropagation();
                // If it's a root note, create another root note
                if (isRoot) {
                  addNote(null);
                } else {
                  // Create a sibling by using parent as the parent
                  addNote(parentId ? { id: parentId, children: [] } as any : null);
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
                    {hasChildren && 
                      <span className="font-medium text-red-500 block mt-2">
                        Warning: This will also delete {note.children.length} child note{note.children.length !== 1 ? 's' : ''}!
                      </span>
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteNote(note.id)}
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
          
          {/* Replace with a subtle persistent indicator */}
          {note.children.length > 0 && (
            <div className="h-2 flex items-center justify-center">
              <div className={cn(
                "h-[1px] w-1/3 transition-all duration-200",
                isOverChildArea ? "bg-primary opacity-70" : "bg-gray-500 opacity-20 group-hover:opacity-40"
              )}></div>
            </div>
          )}
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
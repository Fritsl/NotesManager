import { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Link, Youtube } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { cn } from "@/lib/utils";
import DropZone from "./DropZone";
import { levelColors } from "@/lib/level-colors";
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
          
          // Calculate thresholds
          const topThreshold = noteHeight * 0.25; // Top 25% = "Above" zone
          const bottomThreshold = noteHeight * 0.75; // Bottom 25% = "Below" zone
          const rightThreshold = noteWidth * 0.7; // Right 30% = "Inside" zone
          
          // Get mouse position relative to the note
          const offsetY = clientOffset.y - hoverBoundingRect.top;
          const offsetX = clientOffset.x - hoverBoundingRect.left;
          
          // Check if in the right side zone (Inside, as a child)
          if (offsetX > rightThreshold) {
            // Add as a child of the current note (Inside)
            // When adding as a child, default position is at the END of child list
            moveNote(draggedItemId, note.id, note.children.length);
          } 
          // Check if in the top zone (Above, same level)
          else if (offsetY < topThreshold) {
            // For "Above" - place it at the same level (sibling) regardless of original level
            moveNote(draggedItemId, parentId, index);
          } 
          // Check if in the bottom zone (Below, same level)
          else if (offsetY > bottomThreshold) {
            // For "Below" - place it at the same level (sibling) regardless of original level
            moveNote(draggedItemId, parentId, index + 1);
          }
          // Middle area (default to below)
          else {
            // Default to below for the middle area
            moveNote(draggedItemId, parentId, index + 1);
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
        
        // Get the client offset to determine drop position
        const clientOffset = monitor.getClientOffset();
        
        // When dropping directly in the child area (not on a specific child), 
        // determine if we should append the note instead of prepending it
        if (clientOffset && note.children.length > 0) {
          const childAreaRect = childAreaRef.current?.getBoundingClientRect();
          if (childAreaRect) {
            // If we're dropping closer to the bottom of the child area, append as the last child
            const offsetY = clientOffset.y - childAreaRect.top;
            const childAreaHeight = childAreaRect.bottom - childAreaRect.top;
            const dropPosition = offsetY / childAreaHeight;
            
            if (dropPosition > 0.8) {
              // If dropping in the bottom 20% of the child area, add as the last child
              moveNote(draggedItemId, note.id, note.children.length);
              return;
            }
          }
        }
        
        // Default: Move the dragged note to be the last child of the current note
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
            "note-card border rounded-md p-2 transition flex items-start group shadow-sm hover:shadow relative",
            // Use the level color themes for consistent styling
            levelColors[Math.min(level, 8)].bg,
            `border-l-[4px] ${levelColors[Math.min(level, 8)].border}`,
            // Don't highlight the entire note, we'll use a bottom border instead
            selectedNote?.id === note.id ? "border-primary ring-2 ring-primary ring-opacity-50" : "border-gray-200 hover:bg-opacity-80",
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
            // Highlight when dragging over right side
            isOver && isOverRight && "bg-primary opacity-50 w-2"
          )}></div>
          
          <div className="drag-handle mr-2 text-gray-400 hover:text-gray-600 cursor-grab">
            <GripVertical size={16} />
          </div>
          
          <Button
            variant="ghost" 
            size="sm" 
            className={`h-5 min-w-[1.5rem] p-0 mr-1 flex items-center justify-start ${hasChildren ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) {
                toggleExpand(note.id);
              }
            }}
            disabled={!hasChildren}
          >
            {hasChildren 
              ? (isExpanded 
                  ? <ChevronDown size={14} /> 
                  : <div className="flex items-center">
                      <ChevronRight size={14} />
                      {note.children.length > 0 && (
                        <span className="ml-1 text-xs text-gray-400 font-mono">{note.children.length}</span>
                      )}
                    </div>
                )
              : <div className="w-3 h-3 rounded-full bg-gray-200"></div>
            }
          </Button>
          
          <div className="flex-1 overflow-hidden">
            {/* Title line - larger and more prominent with position badge */}
            <div className="flex items-center">
              <div className={`text-sm font-medium ${levelColors[Math.min(level, 8)].text} truncate flex-1`}>{displayContent}</div>
              <div className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 ml-2">pos: {note.position}</div>
            </div>
            
            {/* Multiple preview lines */}
            {previewLines.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {previewLines.map((line, index) => (
                  <div key={index} className="text-xs text-gray-600 truncate leading-snug">{line}</div>
                ))}
                {hasMoreLines && (
                  <div className="text-xs text-gray-400 italic">more...</div>
                )}
              </div>
            )}
            
            {/* Badges for special attributes */}
            {(note.youtube_url || note.url) && (
              <div className="flex space-x-2 mt-1">
                {note.youtube_url && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    <Youtube size={12} className="mr-1" />
                    YouTube
                  </span>
                )}
                
                {note.url && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    <Link size={12} className="mr-1" />
                    {note.url_display_text || "Link"}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-primary p-1"
              title="Add Child"
              onClick={(e) => {
                e.stopPropagation();
                addNote(note);
              }}
            >
              <Plus size={14} />
            </Button>
            
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-red-500 p-1"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Trash2 size={14} />
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
                isOverChildArea ? "bg-primary opacity-70" : "bg-gray-200 opacity-20 group-hover:opacity-40"
              )}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
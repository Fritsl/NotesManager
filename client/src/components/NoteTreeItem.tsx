import { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Link, Youtube } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { cn } from "@/lib/utils";
import DropZone from "./DropZone";
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
}

interface DragItem {
  type: string;
  id: string;
  index?: number;
  isRoot?: boolean;
}

export default function NoteTreeItem({ note, level, toggleExpand, isExpanded, index = 0, isRoot = false }: NoteTreeItemProps) {
  const { selectedNote, selectNote, addNote, deleteNote, moveNote } = useNotes();
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

  // Set up drop for moving notes within the tree
  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: 'NOTE',
    drop: (item, monitor) => {
      if (item.id !== note.id) {
        // Get the dragged note ID
        const draggedItemId = item.id;
        
        // If the note is dropped onto itself or its own child, ignore it
        const isChild = checkIfChild(note, draggedItemId);
        if (note.id === draggedItemId || isChild) {
          return;
        }
        
        // Handle dropping differently for root-level reordering
        if (isRoot && item.isRoot) {
          // For root-to-root reordering, we want to keep it at the root level but change position
          moveNote(draggedItemId, null, index);
        } else {
          // For non-root items or moving a root to become a child, add as a child of the current note
          moveNote(draggedItemId, note.id, note.children.length);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Helper to check if a note is a child of another
  const checkIfChild = (parentNote: Note, childId: string): boolean => {
    for (const child of parentNote.children) {
      if (child.id === childId || checkIfChild(child, childId)) {
        return true;
      }
    }
    return false;
  };

  // Set up child area drop
  const [{ isOverChildArea }, dropChildArea] = useDrop<DragItem, void, { isOverChildArea: boolean }>({
    accept: 'NOTE',
    drop: (item) => {
      if (item.id !== note.id) {
        const draggedItemId = item.id;
        
        // If the note is dropped onto itself or its own child, ignore it
        const isChild = checkIfChild(note, draggedItemId);
        if (note.id === draggedItemId || isChild) {
          return;
        }
        
        // Move the dragged note as the first child of the current note
        moveNote(draggedItemId, note.id, 0);
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

  // Truncate content for display in the tree
  const displayContent = note.content
    .split('\n')[0]
    .slice(0, 40)
    + (note.content.length > 40 ? '...' : '');

  // Get a secondary line if available
  const secondLine = note.content.split('\n')[1];
  const displaySecondLine = secondLine ? secondLine.slice(0, 40) + (secondLine.length > 40 ? '...' : '') : null;

  return (
    <div className="note-tree-item">
      <div 
        ref={ref}
        className={cn(
          "note-card bg-white border rounded p-2 transition flex items-start group",
          isOver && "border-primary bg-primary/5",
          selectedNote?.id === note.id ? "border-primary bg-blue-50" : "border-gray-200 hover:bg-gray-50",
          isDragging && "opacity-50"
        )}
        onClick={() => selectNote(note)}
      >
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
          <div className="text-sm font-medium text-gray-700 truncate">{displayContent}</div>
          {displaySecondLine && (
            <div className="text-xs text-gray-500 truncate">{displaySecondLine}</div>
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
      
      {/* Children container */}
      {hasChildren && isExpanded && (
        <div 
          ref={dropChildArea}
          className={cn(
            "ml-6 mt-2 space-y-2 tree-line relative",
            isOverChildArea && "bg-primary/5 border border-dashed border-primary rounded-md p-2"
          )}
        >
          {/* Initial drop zone for first position */}
          <DropZone index={0} />
          
          {note.children.map((child, idx) => (
            <div key={child.id}>
              <NoteTreeItem
                note={child}
                level={level + 1}
                index={idx}
                isRoot={false}
                toggleExpand={toggleExpand}
                isExpanded={isExpanded}
              />
              <DropZone index={idx + 1} />
            </div>
          ))}
          
          {/* Add hint for dropping at the end */}
          {!isOverChildArea && note.children.length > 0 && (
            <div className="text-xs text-gray-400 text-center py-1 italic opacity-0 group-hover:opacity-60">
              Drop here to add as child
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { useNotes } from "@/context/NotesContext";

interface DropZoneProps {
  index: number;
  parentId?: string | null;
}

interface DragItem {
  type: string;
  id: string;
  index?: number;
  isRoot?: boolean;
}

export default function DropZone({ index, parentId = null }: DropZoneProps) {
  const { moveNote, notes } = useNotes();

  // Set up drop zone for reordering (both root-level and within children)
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>({
    accept: 'NOTE',
    canDrop: (item) => {
      // Don't allow a note to be dropped into its own children
      if (parentId) {
        // Find the parent note
        const findNote = (noteId: string, notes: any[]): any | undefined => {
          for (const note of notes) {
            if (note.id === noteId) return note;
            if (note.children && note.children.length) {
              const found = findNote(noteId, note.children);
              if (found) return found;
            }
          }
          return undefined;
        };
        
        const parentNote = findNote(parentId, notes);
        
        // Function to check if dropping node is an ancestor of target
        const isAncestorOf = (dropId: string, targetId: string, notesArr: any[]): boolean => {
          // Find the note with id dropId
          const dropNote = findNote(dropId, notesArr);
          if (!dropNote) return false;
          
          // Check if any of its children (recursively) has id targetId
          const hasTarget = (note: any): boolean => {
            if (!note.children || note.children.length === 0) return false;
            return note.children.some((child: any) => 
              child.id === targetId || hasTarget(child)
            );
          };
          
          return hasTarget(dropNote);
        };
        
        // Don't allow dropping a note into its own descendant
        if (isAncestorOf(item.id, parentId, notes)) {
          return false;
        }
      }
      
      // Allow dropping of ANY note, regardless of whether it's currently a root or child
      return true;
    },
    drop: (item) => {
      // Move the note to the specified position at the specified parent
      moveNote(item.id, parentId, index);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Show a subtle horizontal line that highlights during hover
  return (
    <div 
      ref={drop}
      className="h-1 relative my-[1px]" // Fixed height to prevent jumping
    >
      {/* Always visible subtle line */}
      <div className={cn(
        "absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-[1px] transition-all duration-200",
        // Normal state: barely visible line
        !isOver && "bg-gray-200 opacity-30",
        // Active drop target: prominent indicator without changing size
        isOver && canDrop && "bg-primary h-[2px] opacity-70"
      )} />
    </div>
  );
}
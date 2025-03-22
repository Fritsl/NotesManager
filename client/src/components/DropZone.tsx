import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { useNotes } from "@/context/NotesContext";

interface DropZoneProps {
  index: number;
}

interface DragItem {
  type: string;
  id: string;
  index?: number;
  isRoot?: boolean;
}

export default function DropZone({ index }: DropZoneProps) {
  const { moveNote } = useNotes();

  // Set up drop zone for root-level reordering
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>({
    accept: 'NOTE',
    canDrop: (item) => {
      // Allow dropping if it's a root note (no other restrictions)
      return !!item.isRoot;
    },
    drop: (item) => {
      // Move the note to the specified position at the root level
      moveNote(item.id, null, index);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Show drop indicator with improved visibility
  return (
    <div 
      ref={drop}
      className={cn(
        "h-3 my-1 z-10 transition-all duration-200 relative group",
        isOver && canDrop ? "h-8 bg-primary/20 border-2 border-dashed border-primary rounded-md my-2" : ""
      )}
    >
      {/* Always visible hint line */}
      <div className={cn(
        "absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-gray-200 group-hover:bg-primary/40 transition-colors",
        isOver && canDrop ? "opacity-0" : "opacity-100"
      )} />
      
      {/* Drop here text - only visible on hover when not active */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-400 opacity-0 group-hover:opacity-100 pointer-events-none",
        isOver && canDrop ? "opacity-0" : "group-hover:opacity-100"
      )}>
        Drop here
      </div>
    </div>
  );
}
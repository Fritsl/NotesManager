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
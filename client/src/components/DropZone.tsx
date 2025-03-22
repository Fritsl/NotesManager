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
      // Only allow dropping if the item is a root note and not targeting its own position
      return !!item.isRoot && item.index !== index && item.index !== index - 1;
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

  // Show drop indicator only when active
  return (
    <div 
      ref={drop}
      className={cn(
        "h-2 -mt-1 -mb-1 z-10 transition-all duration-200",
        isOver && canDrop ? "h-6 bg-primary/20 border-2 border-dashed border-primary rounded-md my-1" : ""
      )}
    />
  );
}
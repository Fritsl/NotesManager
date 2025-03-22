import { useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import DropZone from "./DropZone";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function NoteTree() {
  const { 
    notes, 
    addNote, 
    expandedNodes, 
    toggleExpand, 
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel 
  } = useNotes();

  // Check if a node is expanded
  const isExpanded = (noteId: string) => {
    return expandedNodes.has(noteId);
  };
  
  // Expand one more level
  const expandMoreLevel = () => {
    expandToLevel(currentLevel + 1);
  };
  
  // Collapse one level
  const collapseOneLevel = () => {
    if (currentLevel > 0) {
      expandToLevel(currentLevel - 1);
    }
  };
  
  // Set up keyboard shortcuts for expand/collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if there are notes
      if (notes.length === 0) return;
      
      // If user is typing in an input or textarea, don't handle keyboard shortcuts
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      // Ctrl+E to expand all
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        expandAll();
      }
      
      // Ctrl+C to collapse all
      if (e.ctrlKey && e.key === 'c') {
        // Skip if the user is trying to copy text
        if (window.getSelection()?.toString()) return;
        
        e.preventDefault();
        collapseAll();
      }
      
      // Z - Collapse one level (no modifier needed - dedicated keys for tree navigation)
      if (e.key === 'z' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        collapseOneLevel();
      }
      
      // X - Expand one more level
      if (e.key === 'x' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        expandMoreLevel();
      }
      
      // Number keys 1-3 with Ctrl to expand to specific levels
      // Keep these as they can be convenient for quick jumps
      if (e.ctrlKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const level = parseInt(e.key);
        expandToLevel(level);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notes, expandAll, collapseAll, expandToLevel, currentLevel]);

  return (
    <div className="p-2">
      <div className="relative">
        {/* First drop zone for moving items to beginning */}
        {notes.length > 0 && <DropZone index={0} />}
        
        {/* Map notes and add drop zones between each */}
        {notes.map((note, index) => (
          <div key={note.id}>
            <NoteTreeItem
              note={note}
              level={0}
              toggleExpand={toggleExpand}
              isExpanded={isExpanded(note.id)}
              index={index}
              isRoot={true}
            />
            <DropZone index={index + 1} />
          </div>
        ))}
        
        {notes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No notes yet</p>
            <Button
              variant="outline"
              onClick={() => addNote(null)}
              className="flex items-center mx-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add your first note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

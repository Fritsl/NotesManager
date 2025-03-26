import { useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import DropZone from "./DropZone";
import { Button } from "@/components/ui/button";
import { Plus, FilePlus, RotateCcw } from "lucide-react";

export default function NoteTree() {
  const { 
    notes, 
    addNote, 
    expandedNodes, 
    toggleExpand, 
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel,
    currentProjectName,
    hasActiveProject,
    maxDepth,
    canUndo,
    undoLastAction,
    getUndoDescription
  } = useNotes();
  
  // Debug current project name
  console.log("NoteTree - Current Project Name:", currentProjectName);

  // Check if a node is expanded
  const isExpanded = (noteId: string) => {
    return expandedNodes.has(noteId);
  };
  
  // Expand one more level, but cap at maxDepth
  const expandMoreLevel = () => {
    console.log(`Expand more level: current=${currentLevel}, max=${maxDepth}`);
    // Ensure we don't exceed the maximum depth of the hierarchy
    const newLevel = Math.min(currentLevel + 1, maxDepth);
    console.log(`Setting new level to: ${newLevel}`);
    expandToLevel(newLevel);
  };
  
  // Collapse one level
  const collapseOneLevel = () => {
    console.log(`Collapse one level: current=${currentLevel}`);
    // Don't allow collapsing below level 0 (fully collapsed)
    if (currentLevel > 0) {
      const newLevel = currentLevel - 1;
      console.log(`Setting new level to: ${newLevel}`);
      expandToLevel(newLevel);
    } else {
      // If already at level 0, ensure it's properly collapsed
      console.log(`Already at level 0, ensuring it's collapsed`);
      expandToLevel(0);
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
      
      // Number keys 0-5 with Ctrl to expand to specific levels
      // Keep these as they can be convenient for quick jumps
      if (e.ctrlKey && ['0', '1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const level = parseInt(e.key);
        expandToLevel(level);
      }
      
      // Ctrl+Z for undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo) {
          console.log('Undoing last action');
          undoLastAction();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notes, expandAll, collapseAll, expandToLevel, currentLevel, maxDepth, expandMoreLevel, collapseOneLevel, canUndo, undoLastAction]);

  return (
    <div className="p-2">
      {hasActiveProject && (
        <div className="relative">
          {/* Undo button - only show when undo is available */}
          {canUndo && (
            <div className="mb-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex items-center gap-1 text-gray-400 hover:text-gray-200 border-gray-800"
                onClick={() => undoLastAction()}
                title={getUndoDescription()}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Undo Move (Ctrl+Z)</span>
              </Button>
            </div>
          )}
          
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
            <div className="fixed inset-0 flex items-center justify-center">
              <Button
                variant="outline"
                onClick={() => addNote(null)}
                className="flex items-center"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add a note
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

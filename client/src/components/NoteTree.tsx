import { useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import DropZone from "./DropZone";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      <div className="flex justify-between items-center py-1 px-1 border-b">
        <div className="text-xs text-gray-500 flex items-center">
          <span className="font-semibold text-gray-700">L{currentLevel}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0 ml-1">
                  <Info className="h-3 w-3 text-gray-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-medium mb-1">Keyboard Shortcuts:</p>
                <ul className="list-disc ml-3 space-y-0.5">
                  <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">Z</kbd> Collapse one level</li>
                  <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">X</kbd> Expand one more level</li>
                  <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">Ctrl+1-5</kbd> Jump to level</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Compact navigation controls */}
        <div className="flex items-center gap-1">
          {/* Level controls */}
          <div className="flex items-center">
            {[1, 2, 3].map(level => (
              <Button
                key={`level-${level}`}
                variant={currentLevel === level ? "default" : "ghost"}
                size="sm"
                onClick={() => expandToLevel(level)}
                className="h-6 w-6 p-0"
                title={`Level ${level} (Ctrl+${level})`}
              >
                <span className="text-xs">L{level}</span>
              </Button>
            ))}
          </div>
          
          {/* Add Note */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => addNote(null)}
            title="Add Root Note"
            className="h-6 w-6 ml-1"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
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

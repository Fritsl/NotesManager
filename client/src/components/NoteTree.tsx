import { useState, useCallback, useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  MinusCircle, 
  PlusCircle,
  Layers,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function NoteTree() {
  const { notes, addNote } = useNotes();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Toggle expansion for a single node
  const toggleExpand = (noteId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  // Check if a node is expanded
  const isExpanded = (noteId: string) => {
    return expandedNodes.has(noteId);
  };

  // Helper function to get the node level in the tree
  const getNodeLevel = useCallback((noteId: string, notesArray: Note[] = notes, level = 0): number => {
    for (const note of notesArray) {
      if (note.id === noteId) {
        return level;
      }
      
      if (note.children.length > 0) {
        const foundLevel = getNodeLevel(noteId, note.children, level + 1);
        if (foundLevel !== -1) {
          return foundLevel;
        }
      }
    }
    
    return -1;
  }, [notes]);

  // Helper function to collect note IDs at a specific level or up to a specific level
  const getNoteIdsByLevel = useCallback((
    notesArray: Note[], 
    maxLevel: number, 
    currentLevel = 0, 
    exactLevel = false
  ): string[] => {
    let ids: string[] = [];
    
    notesArray.forEach(note => {
      // If we're collecting notes up to a specific level
      if (!exactLevel && currentLevel <= maxLevel) {
        ids.push(note.id);
      }
      
      // If we're collecting notes at an exact level
      if (exactLevel && currentLevel === maxLevel) {
        ids.push(note.id);
      }
      
      // If the note has children, recursively collect their IDs
      if (note.children.length > 0 && currentLevel < maxLevel) {
        ids = [...ids, ...getNoteIdsByLevel(
          note.children, 
          maxLevel, 
          currentLevel + 1, 
          exactLevel
        )];
      }
    });
    
    return ids;
  }, []);

  // Helper function to collect all note IDs in the tree
  const getAllNoteIds = useCallback((notesArray: Note[]): string[] => {
    let ids: string[] = [];
    notesArray.forEach(note => {
      ids.push(note.id);
      if (note.children.length > 0) {
        ids = [...ids, ...getAllNoteIds(note.children)];
      }
    });
    return ids;
  }, []);

  // Expand all nodes
  const expandAll = () => {
    const allIds = getAllNoteIds(notes);
    setExpandedNodes(new Set(allIds));
  };

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Expand to a specific level
  const expandToLevel = (level: number) => {
    const idsToExpand = getNoteIdsByLevel(notes, level - 1);
    setExpandedNodes(new Set(idsToExpand));
  };

  // Expand only a specific level
  const expandLevel = (level: number) => {
    // First collect parent nodes up to the target level
    const parentIds = getNoteIdsByLevel(notes, level - 1);
    
    // Then collect nodes at the exact target level
    const levelIds = getNoteIdsByLevel(notes, level, 0, true);
    
    // Combine both sets
    setExpandedNodes(new Set([...parentIds, ...levelIds]));
  };
  
  // Set up keyboard shortcuts for expand/collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if there are notes
      if (notes.length === 0) return;
      
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
      
      // Number keys 1-3 with Ctrl to expand to specific levels
      if (e.ctrlKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const level = parseInt(e.key);
        expandToLevel(level);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notes, getAllNoteIds, getNoteIdsByLevel]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">Notes Structure</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => addNote(null)}
          title="Add Root Note"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Expand/Collapse Controls */}
      {notes.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="flex items-center text-xs"
              title="Shortcut: Ctrl + E"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="flex items-center text-xs"
              title="Shortcut: Ctrl + C"
            >
              <ChevronUp className="h-3 w-3 mr-1" />
              Collapse All
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <kbd className="ml-1 hidden sm:inline-flex text-[10px] font-mono px-1.5 bg-gray-100 text-gray-500 rounded border border-gray-300 cursor-help">
                    Ctrl+E/C
                  </kbd>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p className="font-semibold mb-1">Keyboard Shortcuts:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+E</kbd> Expand All</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+C</kbd> Collapse All</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+1</kbd> Expand to level 1</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+2</kbd> Expand to level 2</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+3</kbd> Expand to level 3</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4 text-sm border-t pt-2">
            <div className="text-xs text-gray-500 w-full mb-1 flex items-center">
              <Layers className="h-3 w-3 mr-1" />
              <span className="mr-1">Expand to level:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                      <Info className="h-3 w-3 text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Control how much of the tree to show:</p>
                    <ul className="list-disc ml-4 mt-1 text-xs">
                      <li><strong>L1</strong>: Show only root notes</li>
                      <li><strong>L2</strong>: Show root notes and their immediate children</li>
                      <li><strong>L3</strong>: Show up to three levels deep</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {[1, 2, 3].map(level => (
              <Button
                key={`level-${level}`}
                variant="outline"
                size="sm"
                onClick={() => expandToLevel(level)}
                className="flex items-center text-xs px-2 py-0 h-6"
                title={`Expand to level ${level} (Ctrl+${level})`}
              >
                <span>L{level}</span>
                <kbd className="ml-1 text-[9px] text-gray-400 font-mono hidden sm:inline-block">
                  {level}
                </kbd>
              </Button>
            ))}
          </div>
        </>
      )}
      
      <div className="space-y-2">
        {notes.map((note) => (
          <NoteTreeItem
            key={note.id}
            note={note}
            level={0}
            toggleExpand={toggleExpand}
            isExpanded={isExpanded(note.id)}
          />
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

import { useState, useCallback, useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import DropZone from "./DropZone";
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

  // Track current expansion level
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  
  // Expand to a specific level (L1, L2, L3, etc.)
  const expandToLevel = (level: number) => {
    // Ensure level is at least 0
    const targetLevel = Math.max(0, level);
    
    // We need to expand different sets of nodes based on the level
    let idsToExpand: string[] = [];
    
    // Always expand level 0 (root nodes)
    if (targetLevel >= 1) {
      // For Level 1, just make sure root nodes are visible (no expansion needed)
      // For Level 2, expand root nodes to show their immediate children
      // For Level 3, expand root nodes and their children, etc.
      const maxLevelToExpand = targetLevel - 1;
      
      // Collect nodes that need to be expanded (not the nodes themselves, but their parents)
      // For example, to show level 2 nodes, we need to expand level 1 nodes
      for (let i = 0; i < maxLevelToExpand; i++) {
        const nodesAtLevel = getNoteIdsByLevel(notes, i, 0, true);
        idsToExpand = [...idsToExpand, ...nodesAtLevel];
      }
    }
    
    // Update the current level
    setCurrentLevel(targetLevel);
    
    // Update expanded nodes
    setExpandedNodes(new Set(idsToExpand));
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
  }, [notes, getAllNoteIds, getNoteIdsByLevel, currentLevel]);

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
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Z</kbd> Collapse one level</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">X</kbd> Expand one more level</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+1-5</kbd> Jump to specific level</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+E</kbd> Expand All</li>
                    <li><kbd className="px-1 bg-gray-100 rounded text-[10px]">Ctrl+C</kbd> Collapse All</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4 text-sm border-t pt-2">
            <div className="text-xs text-gray-500 w-full mb-1 flex items-center justify-between">
              <div className="flex items-center">
                <Layers className="h-3 w-3 mr-1" />
                <span className="mr-1">Level-based navigation:</span>
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
                        <li><strong>L3+</strong>: Show deeper levels as needed</li>
                        <li><strong>Z/X</strong>: Collapse/expand one level at a time</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <div className="text-xs">
                <span className="text-gray-500">Current: </span>
                <span className="font-semibold">L{currentLevel}</span>
              </div>
            </div>
            
            {/* Level by level navigation */}
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={collapseOneLevel}
                className="flex items-center text-xs px-2 py-0 h-6"
                title="Collapse one level (shortcut: Z)"
                disabled={currentLevel === 0}
              >
                <MinusCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Collapse</span>
                <span className="sm:hidden">-</span>
                <kbd className="ml-1 text-[9px] text-gray-400 font-mono hidden sm:inline-block">Z</kbd>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={expandMoreLevel}
                className="flex items-center text-xs px-2 py-0 h-6"
                title="Expand one more level (shortcut: X)"
              >
                <PlusCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Expand</span>
                <span className="sm:hidden">+</span>
                <kbd className="ml-1 text-[9px] text-gray-400 font-mono hidden sm:inline-block">X</kbd>
              </Button>
            </div>
            
            {/* Fixed level buttons */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(level => (
                <Button
                  key={`level-${level}`}
                  variant={currentLevel === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => expandToLevel(level)}
                  className="flex items-center text-xs px-2 py-0 h-6"
                  title={`Expand to level ${level} (Ctrl+${level})`}
                >
                  <span>L{level}</span>
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
      
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

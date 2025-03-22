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

import React, { useState, useEffect } from "react";
import { Note } from "@/types/notes";
import { useNotes } from "@/context/NotesContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ArrowDown, 
  ArrowUp, 
  ChevronDown, 
  ChevronRight,
  Search,
  PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { levelColors } from "@/lib/level-colors";
import { useToast } from "@/hooks/use-toast";

interface MoveNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToMove: Note | null;
}

export default function MoveNoteModal({ isOpen, onClose, noteToMove }: MoveNoteModalProps) {
  const { notes, moveNote, scrollToNote, setPendingNoteMoves } = useNotes();
  const { toast } = useToast();
  
  // State for tree view only
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  
  // Reset state when modal opens or note changes
  useEffect(() => {
    if (isOpen && noteToMove) {
      setExpandedNodes([]);
      setSearchText("");
    }
  }, [isOpen, noteToMove]);
  
  // Toggle a node's expanded state
  const toggleNode = (id: string) => {
    setExpandedNodes(prev => 
      prev.includes(id) 
        ? prev.filter(nodeId => nodeId !== id) 
        : [...prev, id]
    );
  };
  
  // Find a note by ID
  const findNoteById = (notesToSearch: Note[], id: string): Note | null => {
    for (const note of notesToSearch) {
      if (note.id === id) return note;
      
      if (note.children.length > 0) {
        const found = findNoteById(note.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  // Filtered notes based on search
  const filteredNotes = searchText.trim() === "" 
    ? notes 
    : filterNotesBySearchText(notes, searchText);
  
  // Recursively filter notes based on search text
  function filterNotesBySearchText(notesToFilter: Note[], query: string): Note[] {
    const filtered: Note[] = [];
    
    for (const note of notesToFilter) {
      // Skip the note being moved
      if (note.id === noteToMove?.id) continue;
      
      // Check if this note matches the search
      const noteMatches = note.content.toLowerCase().includes(query.toLowerCase());
      
      // Filter children recursively
      const filteredChildren = filterNotesBySearchText(note.children, query);
      
      // Include this note if it matches or has matching children
      if (noteMatches || filteredChildren.length > 0) {
        // Clone the note with only matching children
        filtered.push({
          ...note,
          children: filteredChildren
        });
        
        // Auto-expand parent nodes when searching
        if (filteredChildren.length > 0 && !expandedNodes.includes(note.id)) {
          setExpandedNodes(prev => [...prev, note.id]);
        }
      }
    }
    
    return filtered;
  }
  
  // Find parent of a note
  const findParentNote = (noteId: string): { parent: Note | null, position: number } => {
    // Function to search recursively
    const findInChildren = (
      notesToSearch: Note[], 
      targetId: string
    ): { parent: Note | null, position: number } => {
      // Check if target is in the root level
      const rootIndex = notesToSearch.findIndex(n => n.id === targetId);
      if (rootIndex >= 0) {
        return { parent: null, position: rootIndex };
      }
      
      // Search in children of each note
      for (const note of notesToSearch) {
        const childIndex = note.children.findIndex(child => child.id === targetId);
        if (childIndex >= 0) {
          return { parent: note, position: childIndex };
        }
        
        // Recursively search deeper
        if (note.children.length > 0) {
          const result = findInChildren(note.children, targetId);
          if (result.parent !== null || result.position >= 0) {
            return result;
          }
        }
      }
      
      return { parent: null, position: -1 };
    };
    
    return findInChildren(notes, noteId);
  };
  
  // Handle moving the note
  const handleMoveNote = (
    targetParentId: string | null, 
    position: number
  ) => {
    if (!noteToMove) return;
    
    // Execute the move
    moveNote(noteToMove.id, targetParentId, position);
    
    // Set the pending flag to trigger auto-save
    setPendingNoteMoves(true);
    
    // Close the modal
    onClose();
    
    // Highlight and scroll to the note in its new position
    setTimeout(() => scrollToNote(noteToMove.id), 300);
  };
  
  // Render the tree
  const renderNoteTree = (notesToRender: Note[], level = 0) => {
    return notesToRender.map(note => {
      // Skip the note being moved in the tree
      if (note.id === noteToMove?.id) return null;
      
      const isExpanded = expandedNodes.includes(note.id);
      const hasChildren = note.children.length > 0;
      const color = levelColors[Math.min(level, levelColors.length - 1)];
      
      return (
        <div key={note.id} className="fade-in-note">
          <div 
            className={cn(
              "flex items-center rounded-md py-1.5 my-1 px-2 group",
              "hover:bg-gray-800/50 border-l-2 border-transparent",
              "transition-colors overflow-hidden"
            )}
          >
            {/* Indentation and expand/collapse button */}
            <div 
              className="flex items-center gap-1 min-w-0 flex-shrink" 
              style={{ marginLeft: `${level * 12}px` }}
            >
              {/* Expand/collapse button - only visible for notes with children */}
              <button 
                className={cn(
                  "text-gray-400 hover:text-gray-200 p-1 flex-shrink-0",
                  hasChildren ? "visible" : "invisible"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) {
                    toggleNode(note.id);
                  }
                }}
                disabled={!hasChildren}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              
              {/* Note content */}
              <div 
                className={cn(
                  "truncate text-sm font-medium max-w-[150px] sm:max-w-[250px] md:max-w-[300px]",
                  color.text
                )}
              >
                {note.content}
              </div>
            </div>
            
            {/* Placement buttons - always visible but more opacity on hover */}
            <div className="flex gap-1 sm:gap-2 opacity-60 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0">
              {/* Place inside button */}
              <button
                className="text-gray-300 hover:text-primary p-1 rounded-md hover:bg-gray-700 text-xs flex items-center gap-1 border border-gray-700"
                title="Move inside as child"
                onClick={() => handleMoveNote(note.id, 0)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Inside</span>
              </button>
              
              {/* Place above button */}
              <button
                className="text-gray-300 hover:text-primary p-1 rounded-md hover:bg-gray-700 text-xs flex items-center gap-1 border border-gray-700"
                title="Place above"
                onClick={() => {
                  const { parent, position } = findParentNote(note.id);
                  handleMoveNote(parent?.id ?? null, position);
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Above</span>
              </button>
              
              {/* Place below button */}
              <button
                className="text-gray-300 hover:text-primary p-1 rounded-md hover:bg-gray-700 text-xs flex items-center gap-1 border border-gray-700"
                title="Place below"
                onClick={() => {
                  const { parent, position } = findParentNote(note.id);
                  handleMoveNote(parent?.id ?? null, position + 1);
                }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Below</span>
              </button>
            </div>
          </div>
          
          {/* Children */}
          {isExpanded && note.children.length > 0 && (
            <div className="pl-1">
              {renderNoteTree(note.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };
  
  return (
    <Dialog open={isOpen && !!noteToMove} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[90vw] bg-gray-900 text-gray-100 border-gray-800 h-[85vh] flex flex-col">
        <DialogHeader className="pb-2 border-b border-gray-800">
          <DialogTitle className="text-base flex items-center gap-2">
            <span>Move Note</span>
            {noteToMove && (
              <span className="text-sm font-normal text-gray-400 truncate max-w-[80%]">
                ({noteToMove.content.substring(0, 30)}{noteToMove.content.length > 30 ? "..." : ""})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 py-4 overflow-hidden">
          {/* Search input */}
          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search notes..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          
          {/* Root level placement options */}
          <div className="mb-4 px-2 py-3 bg-gray-800/50 rounded-md border border-gray-700">
            <div className="text-sm text-gray-300 mb-2 font-medium">
              Place at Root Level:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="text-gray-300 hover:text-primary p-1.5 rounded-md hover:bg-gray-700 
                          text-xs flex items-center gap-1 border border-gray-700 flex-1"
                onClick={() => handleMoveNote(null, 0)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>At Top</span>
              </button>
              <button
                className="text-gray-300 hover:text-primary p-1.5 rounded-md hover:bg-gray-700 
                          text-xs flex items-center gap-1 border border-gray-700 flex-1"
                onClick={() => handleMoveNote(null, notes.length)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>At Bottom</span>
              </button>
            </div>
          </div>
          
          {/* Tree view section - fills remaining space */}
          <div className="flex-1 overflow-y-auto pr-2 pb-4">
            <div className="text-sm text-gray-300 mb-2 font-medium px-2">
              Or select a location:
            </div>
            <div className="space-y-0.5 mb-6">
              {filteredNotes.length > 0 ? (
                renderNoteTree(filteredNotes)
              ) : (
                <div className="text-gray-400 text-sm py-10 text-center">
                  {searchText ? "No notes match your search" : "No notes to display"}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
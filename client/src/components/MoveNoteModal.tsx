import React, { useState, useEffect } from "react";
import { Note } from "@/types/notes";
import { useNotes } from "@/context/NotesContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ArrowDown, 
  ArrowUp, 
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  XCircle, 
  Search,
  FolderOpen,
  PlusCircle,
  Folder
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
  
  // State for tree view
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showPlacementOptions, setShowPlacementOptions] = useState(false);
  const [siblingNotes, setSiblingNotes] = useState<Note[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // Reset selection when modal opens or note changes
  useEffect(() => {
    if (isOpen && noteToMove) {
      setExpandedNodes([]);
      setActiveNoteId(null);
      setSearchText("");
      setShowPlacementOptions(false);
      setSelectedParentId(null);
      setSiblingNotes([]);
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
  
  // When a note is selected, determine its siblings for placement context
  useEffect(() => {
    if (activeNoteId === null) {
      // Root level siblings
      const rootSiblings = notes.filter(note => note.id !== noteToMove?.id);
      setSiblingNotes(rootSiblings);
      setSelectedParentId(null);
    } else {
      // Find the parent and siblings of the active note
      findPlacementContext(activeNoteId);
    }
  }, [activeNoteId, notes, noteToMove]);

  // Find the placement context (parent and siblings) for the selected note
  const findPlacementContext = (noteId: string) => {
    // If selecting the note itself, get its children
    if (noteId === noteToMove?.id) {
      setSelectedParentId(null);
      setSiblingNotes([]);
      return;
    }
    
    // Find the parent of the selected note to get siblings
    const findParentAndSiblings = (notesToSearch: Note[], target: string): { parent: Note | null, siblings: Note[] } | null => {
      for (const note of notesToSearch) {
        // Check if this note is the target, use it as a parent for children
        if (note.id === target) {
          return { 
            parent: note, 
            siblings: note.children.filter(child => child.id !== noteToMove?.id)
          };
        }
        
        // Check if target is a direct child of this note
        const childIndex = note.children.findIndex(child => child.id === target);
        if (childIndex >= 0) {
          return { 
            parent: note, 
            siblings: note.children.filter(child => child.id !== noteToMove?.id)
          };
        }
        
        // Recursively check children
        const result = findParentAndSiblings(note.children, target);
        if (result) return result;
      }
      
      return null;
    };
    
    const result = findParentAndSiblings(notes, noteId);
    
    if (result) {
      if (result.parent) {
        setSelectedParentId(result.parent.id);
        setSiblingNotes(result.siblings);
      }
    }
  };
  
  // Handle note movement
  const handleMoveNote = (position: number) => {
    if (!noteToMove) return;
    
    // Execute the move
    moveNote(noteToMove.id, selectedParentId, position);
    
    // Set the pending flag to trigger auto-save
    setPendingNoteMoves(true);
    
    // Close the modal first
    onClose();
    
    // No success toast - only scroll to the moved note
    // Highlight and scroll to the note in its new position
    setTimeout(() => scrollToNote(noteToMove.id), 300);
  };
  
  // Get the name of the currently selected parent
  const getSelectedParentName = () => {
    if (selectedParentId === null) return "Root Level";
    
    const parent = findNoteById(notes, selectedParentId);
    return parent ? parent.content : "Selected Location";
  };
  
  // Render a tree node with its children
  const renderNoteTree = (notesToRender: Note[], level = 0) => {
    return notesToRender.map(note => {
      // Skip the note being moved in the tree
      if (note.id === noteToMove?.id) return null;
      
      const isExpanded = expandedNodes.includes(note.id);
      const isActive = activeNoteId === note.id;
      const hasChildren = note.children.length > 0;
      const color = levelColors[Math.min(level, levelColors.length - 1)];
      
      return (
        <div key={note.id} className="fade-in-note">
          <div 
            className={cn(
              "flex items-center rounded-md py-1.5 my-1 px-2 group",
              isActive ? "bg-gray-800 border-l-2 border-primary" : 
                "hover:bg-gray-800/50 border-l-2 border-transparent",
              "transition-colors"
            )}
          >
            <div 
              className="flex items-center gap-1" 
              style={{ marginLeft: `${level * 12}px` }}
            >
              {/* Expand/collapse button */}
              <button 
                className={cn(
                  "text-gray-400 hover:text-gray-200 p-1",
                  hasChildren ? "visible" : "invisible"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(note.id);
                }}
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
                  "truncate text-sm font-medium flex-1",
                  color.text,
                  "cursor-pointer"
                )}
                onClick={() => {
                  setActiveNoteId(note.id);
                  setShowPlacementOptions(true);
                }}
              >
                {note.content}
              </div>
            </div>
            
            {/* Quick placement buttons */}
            <div className="opacity-0 group-hover:opacity-100 flex gap-1.5 transition-opacity">
              {/* Make this a child or place inside */}
              {hasChildren && (
                <button
                  className="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-700"
                  title="Move inside as a child"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveNoteId(note.id);
                    setShowPlacementOptions(true);
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                </button>
              )}
              
              {/* Place above */}
              <button
                className="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-700"
                title="Place above"
                onClick={(e) => {
                  e.stopPropagation();
                  // Find index of this note in its parent's children
                  setActiveNoteId(note.id);
                  findPlacementContext(note.id);
                  // Find the index where this note appears in its siblings
                  const parent = selectedParentId ? 
                    findNoteById(notes, selectedParentId) : null;
                  const siblings = parent ? 
                    parent.children : notes;
                  const index = siblings.findIndex(n => n.id === note.id);
                  if (index >= 0) {
                    handleMoveNote(index);
                  }
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              
              {/* Place below */}
              <button
                className="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-700"
                title="Place below"
                onClick={(e) => {
                  e.stopPropagation();
                  // Find index of this note in its parent's children
                  setActiveNoteId(note.id);
                  findPlacementContext(note.id);
                  // Find the index where this note appears in its siblings
                  const parent = selectedParentId ? 
                    findNoteById(notes, selectedParentId) : null;
                  const siblings = parent ? 
                    parent.children : notes;
                  const index = siblings.findIndex(n => n.id === note.id);
                  if (index >= 0) {
                    handleMoveNote(index + 1);
                  }
                }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
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
  
  // Render placement options UI
  const renderPlacementOptions = () => {
    return (
      <div className="border-t border-gray-800 pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-primary-400 font-medium flex items-center gap-1.5">
            <Folder className="h-4 w-4" />
            <span>
              {selectedParentId === null ? "Root Level" : 
                `"${getSelectedParentName().substring(0, 30)}${getSelectedParentName().length > 30 ? "..." : ""}"`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={() => setShowPlacementOptions(false)}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        </div>
        
        <div className="space-y-2 mb-4">
          <Button 
            variant="outline"
            className="w-full justify-between bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200 px-4 py-2.5"
            onClick={() => handleMoveNote(0)}
          >
            <span className="text-base">Place at Top</span>
            <ArrowUp className="h-5 w-5 ml-2 text-primary-400" />
          </Button>
          
          {siblingNotes.map((note, index) => (
            <div key={note.id} className="space-y-1.5">
              <div className="flex items-center rounded px-3 py-2 bg-gray-900/70 border border-gray-800">
                <span className="text-gray-400 text-xs mr-2">{index + 1}.</span>
                <span className="text-gray-300 text-sm truncate">{note.content}</span>
              </div>
              
              <Button 
                variant="outline"
                size="sm"
                className="w-full justify-between ml-5 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200 text-sm px-4 py-2"
                onClick={() => handleMoveNote(index + 1)}
              >
                <span>Place below this note</span>
                <ArrowDown className="h-5 w-5 ml-2 text-primary-400" />
              </Button>
            </div>
          ))}
          
          {siblingNotes.length === 0 && (
            <div className="text-gray-500 text-center py-3 italic text-sm">
              No existing notes at this level
            </div>
          )}
          
          {siblingNotes.length > 0 && (
            <Button 
              variant="outline"
              className="w-full justify-between bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200 mt-2 px-4 py-2.5"
              onClick={() => handleMoveNote(siblingNotes.length)}
            >
              <span className="text-base">Place at Bottom</span>
              <ArrowDown className="h-5 w-5 ml-2 text-primary-400" />
            </Button>
          )}
        </div>
      </div>
    );
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
              className="w-full pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                onClick={() => setSearchText("")}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Root level option */}
          <div 
            className={cn(
              "flex items-center rounded-md py-2 px-3 mb-4",
              "bg-gray-800/50 hover:bg-gray-800 cursor-pointer",
              "border border-dashed border-gray-700",
              activeNoteId === null && "bg-gray-800 border-primary"
            )}
            onClick={() => {
              setActiveNoteId(null);
              setShowPlacementOptions(true);
            }}
          >
            <FolderOpen className="h-4 w-4 text-primary-400 mr-2" />
            <span className="text-primary-400 font-medium">Root Level (Top Level)</span>
          </div>
          
          {/* Tree view for notes or placement options */}
          <div className="flex-1 overflow-y-auto pr-2 min-h-0">
            {showPlacementOptions ? (
              renderPlacementOptions()
            ) : (
              <div className="space-y-0.5">
                {filteredNotes.length > 0 ? (
                  renderNoteTree(filteredNotes)
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    {searchText ? "No matching notes found" : "No notes available"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from "react";
import { Note } from "@/types/notes";
import { useNotes } from "@/context/NotesContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, FolderUp, FolderDown, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { levelColors } from "@/lib/level-colors";

interface MoveNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToMove: Note | null;
}

interface Destination {
  id: string | null;
  label: string;
  content: string;
  level: number;
  path: string[];
  hasChildren: boolean;
}

export default function MoveNoteModal({ isOpen, onClose, noteToMove }: MoveNoteModalProps) {
  const { notes, moveNote } = useNotes();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  
  // When in full-screen mode, we'll track the currently focused destination
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  
  // Reset selection when modal opens or note changes
  useEffect(() => {
    if (isOpen && noteToMove) {
      setSelectedParentId(null);
      setSearchText("");
    }
  }, [isOpen, noteToMove]);
  
  // Build the destinations list when modal opens
  useEffect(() => {
    if (!isOpen || !noteToMove) return;
    
    const destinationsList: Destination[] = [
      { 
        id: null, 
        label: "Root Level", 
        content: "Root Level",
        level: 0, 
        path: ["Root"],
        hasChildren: notes.length > 0
      }
    ];
    
    // Helper function to recursively add notes to the destination list
    // Excludes the note being moved and its children
    const addNotesToDestinations = (notesToProcess: Note[], level: number, path: string[] = []) => {
      for (const note of notesToProcess) {
        // Skip the note being moved and all its descendants to prevent cycles
        if (note.id === noteToMove.id) continue;
        
        // Check if this note is a descendant of the noteToMove
        let isDescendant = false;
        const checkIfDescendant = (parent: Note, potentialChild: Note): boolean => {
          for (const child of parent.children) {
            if (child.id === potentialChild.id) return true;
            if (checkIfDescendant(child, potentialChild)) return true;
          }
          return false;
        };
        
        if (noteToMove.children.length > 0) {
          isDescendant = checkIfDescendant(noteToMove, note);
        }
        
        if (!isDescendant) {
          const notePath = [...path, note.content];
          const truncatedContent = note.content.length > 50 
            ? `${note.content.substring(0, 47)}...` 
            : note.content;
          
          destinationsList.push({
            id: note.id,
            label: truncatedContent,
            content: note.content,
            level: level,
            path: notePath,
            hasChildren: note.children.length > 0
          });
          
          // Add children recursively
          if (note.children.length > 0) {
            addNotesToDestinations(
              note.children, 
              level + 1, 
              notePath
            );
          }
        }
      }
    };
    
    addNotesToDestinations(notes, 1, ["Root"]);
    setDestinations(destinationsList);
  }, [isOpen, noteToMove, notes]);
  
  // Filtered destinations based on search text
  const filteredDestinations = searchText.length > 0
    ? destinations.filter(dest => 
        dest.content.toLowerCase().includes(searchText.toLowerCase()) ||
        dest.path.some(p => p.toLowerCase().includes(searchText.toLowerCase()))
      )
    : destinations;
  
  // Filter destinations by parent ID for hierarchical navigation
  const currentLevelDestinations = selectedParentId === undefined
    ? filteredDestinations
    : filteredDestinations.filter(dest => {
        // Root level items
        if (selectedParentId === null) {
          return dest.level === 1 || dest.id === null;
        }
        
        // Find the parent item's level
        const parentItem = filteredDestinations.find(d => d.id === selectedParentId);
        if (parentItem) {
          // Show items that are direct children (one level deeper)
          const findParentInPath = dest.path.findIndex(p => 
            parentItem.path.length > 0 && 
            p === parentItem.path[parentItem.path.length - 1]
          );
          
          return findParentInPath !== -1 && 
                dest.level === parentItem.level + 1 && 
                dest.path.length === parentItem.path.length + 1;
        }
        
        return false;
      });
  
  // Handle note movement
  const handleMoveNote = (destinationId: string | null) => {
    if (!noteToMove) return;
    
    // Determine the position (by default, add to the end)
    let position = 0;
    
    if (destinationId === null) {
      // Moving to root level
      position = notes.length;
    } else {
      // Find destination parent and its children count
      const findDestinationParent = (notesToSearch: Note[]): Note | null => {
        for (const note of notesToSearch) {
          if (note.id === destinationId) return note;
          
          if (note.children.length > 0) {
            const found = findDestinationParent(note.children);
            if (found) return found;
          }
        }
        return null;
      };
      
      const destinationParent = findDestinationParent(notes);
      if (destinationParent) {
        position = destinationParent.children.length;
      }
    }
    
    // Execute the move
    moveNote(noteToMove.id, destinationId, position);
    onClose();
  };
  
  // Format breadcrumb navigation path
  const getCurrentPath = () => {
    if (!selectedParentId) {
      return [{ id: null as null, label: "Root" }];
    }
    
    const currentItem = destinations.find(dest => dest.id === selectedParentId);
    if (!currentItem) return [{ id: null as null, label: "Root" }];
    
    const pathItems: Array<{ id: string | null; label: string }> = [{ id: null as null, label: "Root" }];
    
    // Build path from ancestors
    const findAncestors = (itemLevel: number, itemPath: string[]) => {
      for (let i = 1; i < itemLevel; i++) {
        // Find the ancestor at this level
        const ancestorIndex = destinations.findIndex(d => 
          d.level === i && 
          itemPath.length > i && 
          d.content === itemPath[i]
        );
        
        if (ancestorIndex !== -1) {
          pathItems.push({
            id: destinations[ancestorIndex].id,
            label: destinations[ancestorIndex].content
          });
        }
      }
    };
    
    findAncestors(currentItem.level, currentItem.path);
    
    // Add the current item
    pathItems.push({
      id: currentItem.id,
      label: currentItem.content
    });
    
    return pathItems;
  };
  
  // Format the destination item display
  const renderDestinationItem = (dest: Destination) => {
    const isRoot = dest.id === null;
    const itemColor = levelColors[Math.min(dest.level, levelColors.length - 1)];
    
    return (
      <div 
        key={dest.id || 'root'} 
        className={cn(
          "flex items-center justify-between p-3 mb-2 rounded-md cursor-pointer",
          "hover:bg-gray-800 border border-gray-800 hover:border-gray-700",
          "transition-colors"
        )}
        onClick={() => {
          if (dest.hasChildren) {
            // Navigate into this folder
            setSelectedParentId(dest.id);
          } else {
            // Move note directly to this location
            handleMoveNote(dest.id);
          }
        }}
      >
        <div className="flex items-center gap-2 max-w-[85%]">
          {isRoot ? (
            <FolderUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
          ) : (
            <FolderDown className={cn(
              "h-5 w-5 flex-shrink-0",
              `text-${itemColor.text}`
            )} />
          )}
          
          <div className="flex flex-col">
            <span className={cn(
              "text-sm break-all truncate max-w-[600px]",
              !isRoot && `text-${itemColor.text}`
            )}>
              {dest.label}
            </span>
            
            {!isRoot && dest.path.length > 2 && (
              <span className="text-xs text-gray-500 truncate max-w-[600px]">
                Path: {dest.path.slice(1, -1).join(" › ")}
              </span>
            )}
          </div>
        </div>
        
        {dest.hasChildren && (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </div>
    );
  };
  
  return (
    <Dialog open={isOpen && !!noteToMove} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-gray-900 text-gray-100 border-gray-800 h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <span>Move Note</span>
            {noteToMove && (
              <span className="text-sm font-normal text-gray-400">
                ({noteToMove.content.substring(0, 30)}{noteToMove.content.length > 30 && "..."})
              </span>
            )}
          </DialogTitle>
          
          {/* Dialog description removed to save space */}
        </DialogHeader>
        
        {/* Navigation breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <div className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
            {getCurrentPath().map((item, index) => (
              <div key={item.id || 'root'} className="flex items-center">
                {index > 0 && <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />}
                <button
                  onClick={() => setSelectedParentId(item.id)}
                  className={cn(
                    "px-2 py-1 rounded-md whitespace-nowrap",
                    "hover:bg-gray-800 transition-colors",
                    index === getCurrentPath().length - 1 
                      ? "bg-gray-800 text-primary" 
                      : "text-gray-300"
                  )}
                >
                  {index === 0 ? "Root" : item.label.substring(0, 20) + (item.label.length > 20 ? "..." : "")}
                </button>
              </div>
            ))}
          </div>
          
          {/* Back button for navigation */}
          {selectedParentId !== null && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-gray-700 text-gray-300"
              onClick={() => {
                // Go to parent folder
                const currentPath = getCurrentPath();
                if (currentPath.length > 1) {
                  setSelectedParentId(currentPath[currentPath.length - 2].id);
                } else {
                  setSelectedParentId(null);
                }
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        
        {/* Search input */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search for a location..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
              onClick={() => setSearchText("")}
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Destinations list - scrollable container */}
        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
          {currentLevelDestinations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {searchText ? "No matching destinations found" : "No available destinations at this level"}
            </div>
          ) : (
            currentLevelDestinations.map(renderDestinationItem)
          )}
        </div>
        
        <DialogFooter className="mt-4 pt-4 border-t border-gray-800">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-auto border-gray-700 hover:bg-gray-800 text-gray-300"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
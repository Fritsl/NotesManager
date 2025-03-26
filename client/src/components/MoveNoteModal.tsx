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
import { useToast } from "@/hooks/use-toast";

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
  uniqueId?: string; // Optional unique identifier to prevent key conflicts
}

export default function MoveNoteModal({ isOpen, onClose, noteToMove }: MoveNoteModalProps) {
  const { notes, moveNote, scrollToNote } = useNotes();
  const { toast } = useToast();
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
        hasChildren: notes.length > 0,
        uniqueId: `root-${Date.now()}`
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
            hasChildren: note.children.length > 0,
            uniqueId: `dest-${note.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
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
  
  // When searching, show ALL matching destinations regardless of hierarchy
  // Otherwise, only show destinations at the current level
  const useSearchResults = searchText.length > 0;
  
  // Filtered destinations based on search text - now includes all matches across all levels
  const filteredDestinations = useSearchResults
    ? destinations.filter(dest => 
        dest.content.toLowerCase().includes(searchText.toLowerCase()) ||
        dest.path.some(p => p.toLowerCase().includes(searchText.toLowerCase()))
      )
    : destinations;
  
  // Root item with unique key for search results vs. normal navigation
  const rootItem = {
    id: null,
    label: "Root Level",
    content: "Root Level",
    level: 0,
    path: ["Root"],
    hasChildren: notes.length > 0
  };
  
  // Create a unique ID for each root item to prevent key conflicts
  const searchRootItem = {
    ...rootItem,
    // Add unique identifier for search root
    uniqueId: `search-root-${Date.now()}`
  };
  
  // Only apply parent filter when NOT searching
  const currentLevelDestinations = useSearchResults
    ? filteredDestinations.concat([searchRootItem])
    : selectedParentId === undefined
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
    
    // Save the noteId for later reference
    const movedNoteId = noteToMove.id;
    
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
    moveNote(movedNoteId, destinationId, position);
    
    // Close the modal first
    onClose();
    
    // Show success toast
    toast({
      title: "Note moved",
      description: "Note has been moved to the selected location",
    });
    
    // Add a small delay to allow DOM to update
    setTimeout(() => {
      // Highlight and scroll to the note in its new position
      scrollToNote(movedNoteId);
    }, 300);
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
        key={dest.uniqueId || dest.id || 'root-' + Date.now()}
        className={cn(
          "flex items-center justify-between p-3 mb-2 rounded-md cursor-pointer fade-in-note",
          "hover:bg-gray-800 border border-gray-800 hover:border-gray-700",
          "transition-all duration-150 hover:shadow-md",
          isRoot ? "bg-gray-900 border-gray-700 border-dashed" : `border-l-[4px] ${itemColor.border}`
        )}
        onClick={() => {
          if (isRoot) {
            // Always move directly to root level when root is clicked
            handleMoveNote(null);
            
            // Add animation effect when clicked
            const element = document.getElementById(`dest-${dest.id || 'root'}`);
            if (element) {
              element.classList.add('note-highlight');
            }
          }
          else if (dest.hasChildren) {
            // Navigate into this folder
            setSelectedParentId(dest.id);
          } else {
            // Move note directly to this location
            handleMoveNote(dest.id);
            
            // Add animation effect when clicked
            const element = document.getElementById(`dest-${dest.id || 'root'}`);
            if (element) {
              element.classList.add('note-highlight');
            }
          }
        }}
        id={`dest-${dest.id || 'root'}`}
      >
        <div className="flex items-center gap-2 max-w-[85%]">
          {isRoot ? (
            <FolderUp className="h-5 w-5 text-primary flex-shrink-0" />
          ) : (
            <FolderDown className={cn(
              "h-5 w-5 flex-shrink-0",
              itemColor.text
            )} />
          )}
          
          <div className="flex flex-col">
            <span className={cn(
              "text-sm font-medium truncate max-w-[600px]",
              isRoot ? "text-primary font-bold" : itemColor.text
            )}>
              {isRoot ? "Move to Root Level (Top Level)" : dest.label}
            </span>
            
            {!isRoot && (
              <span className="text-xs text-gray-500 truncate max-w-[600px]">
                {useSearchResults ? (
                  // In search results, always show full path for context
                  <>Path: <span className="text-primary-400">{dest.path.slice(1).join(" › ")}</span></>
                ) : dest.path.length > 2 ? (
                  // In normal navigation, only show path when it's a deeper note
                  <>Path: {dest.path.slice(1, -1).join(" › ")}</>
                ) : null}
              </span>
            )}
          </div>
        </div>
        
        {!isRoot && dest.hasChildren && (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </div>
    );
  };
  
  return (
    <Dialog open={isOpen && !!noteToMove} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] bg-gray-900 text-gray-100 border-gray-800 h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg flex items-center gap-2">
            <span>Move Note</span>
            {noteToMove && (
              <span className="text-sm font-normal text-gray-400">
                ({noteToMove.content.substring(0, 30)}{noteToMove.content.length > 30 && "..."})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {/* Navigation breadcrumb - simplified */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="text-sm font-medium text-gray-300">
            {useSearchResults ? (
              <span>
                <span className="text-primary font-bold">Search Results</span>
                <span className="ml-1 text-xs bg-gray-800 rounded-full px-2 py-0.5">
                  {filteredDestinations.length} match{filteredDestinations.length !== 1 ? 'es' : ''} across all levels
                </span>
              </span>
            ) : selectedParentId === null ? (
              <span className="text-primary font-bold">Browse Locations</span>
            ) : (
              <span>
                Current folder: <span className="text-primary font-medium">
                  {getCurrentPath()[getCurrentPath().length - 1]?.label?.substring(0, 30) || "Location"}
                  {getCurrentPath()[getCurrentPath().length - 1]?.label?.length > 30 ? "..." : ""}
                </span>
              </span>
            )}
          </div>
          
          {/* Back button for navigation - only show when not searching */}
          {!useSearchResults && selectedParentId !== null && (
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-primary"
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
              Back to Previous Level
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
        <div className="flex-1 overflow-y-auto pr-2 min-h-0 max-h-[calc(80vh-150px)]">
          {currentLevelDestinations.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {searchText ? "No matching destinations found" : "No available destinations at this level"}
            </div>
          ) : (
            currentLevelDestinations.map(renderDestinationItem)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
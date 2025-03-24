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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, FolderUp, FolderDown } from "lucide-react";

interface MoveNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToMove: Note | null;
}

export default function MoveNoteModal({ isOpen, onClose, noteToMove }: MoveNoteModalProps) {
  const { notes, moveNote } = useNotes();
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Array<{ id: string | null, label: string, level: number }>>([]);
  
  // Reset selection when modal opens or note changes
  useEffect(() => {
    if (isOpen && noteToMove) {
      setSelectedDestination(null);
    }
  }, [isOpen, noteToMove]);
  
  // Build the destinations list when modal opens
  useEffect(() => {
    if (!isOpen || !noteToMove) return;
    
    const destinationsList: Array<{ id: string | null, label: string, level: number }> = [
      { id: null, label: "Root Level", level: 0 }
    ];
    
    // Helper function to recursively add notes to the destination list
    // Excludes the note being moved and its children
    const addNotesToDestinations = (notesToProcess: Note[], level: number, path: string = "") => {
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
          const notePath = path ? `${path} › ${note.content}` : note.content;
          const truncatedContent = note.content.length > 30 
            ? `${note.content.substring(0, 27)}...` 
            : note.content;
          const displayPath = path ? `${path} › ${truncatedContent}` : truncatedContent;
          
          destinationsList.push({
            id: note.id,
            label: displayPath,
            level: level
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
    
    addNotesToDestinations(notes, 1);
    setDestinations(destinationsList);
  }, [isOpen, noteToMove, notes]);
  
  const handleMoveNote = () => {
    if (!noteToMove) return;
    
    // Find destination parent
    const destinationParentId = selectedDestination;
    
    // Determine the position (by default, add to the end)
    let position = 0;
    
    if (destinationParentId === null) {
      // Moving to root level
      position = notes.length;
    } else {
      // Find destination parent and its children count
      const findDestinationParent = (notesToSearch: Note[]): Note | null => {
        for (const note of notesToSearch) {
          if (note.id === destinationParentId) return note;
          
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
    moveNote(noteToMove.id, destinationParentId, position);
    onClose();
  };
  
  const formatIndentation = (level: number) => {
    if (level === 0) return null;
    
    return (
      <span className="inline-flex items-center">
        <span className="inline-block w-4 mr-1">{level > 1 ? '⋮' : ''}</span>
        <span className="text-gray-400">{
          Array(level).fill('—').join('')
        } </span>
      </span>
    );
  };
  
  return (
    <Dialog open={isOpen && !!noteToMove} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gray-900 text-gray-100 border-gray-800">
        <DialogHeader>
          <DialogTitle>Move Note</DialogTitle>
          <DialogDescription className="text-gray-400">
            {noteToMove ? (
              <div className="mt-2">
                <p className="mb-2">Moving note:</p>
                <div className="p-2 bg-gray-800 rounded border border-gray-700 break-words">
                  <span className="font-medium text-primary">{noteToMove.content}</span>
                  {noteToMove.children.length > 0 && (
                    <p className="text-xs mt-1 text-gray-400">
                      This note has {noteToMove.children.length} child note{noteToMove.children.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : 'Select a destination for this note'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="destination" className="text-gray-300">
              Move to location
            </Label>
            <Select
              value={selectedDestination || ''}
              onValueChange={(value) => setSelectedDestination(value === 'root' ? null : value)}
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-gray-200">
                <SelectValue placeholder="Select a destination" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] bg-gray-800 border-gray-700 text-gray-200">
                {destinations.map((dest) => (
                  <SelectItem 
                    key={dest.id || 'root'} 
                    value={dest.id || 'root'} 
                    className="flex items-center focus:bg-gray-700 focus:text-white"
                  >
                    {dest.id === null ? (
                      <span className="flex items-center gap-2">
                        <FolderUp className="h-4 w-4 text-gray-400" />
                        Root Level
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {formatIndentation(dest.level)}
                        {dest.level === 0 ? <FolderUp className="h-4 w-4" /> : <FolderDown className="h-4 w-4" />}
                        <span className="truncate max-w-[200px]">{dest.label}</span>
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-xs text-gray-400 space-y-2">
            <p>
              <FolderUp className="h-3 w-3 inline mr-1" /> Root Level: Note will be placed at the top level
            </p>
            <p>
              <FolderDown className="h-3 w-3 inline mr-1" /> Inside Note: Will be placed as a child of the selected note
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto border-gray-700 hover:bg-gray-800 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMoveNote}
            className="w-full sm:w-auto"
            disabled={selectedDestination === undefined}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Move Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
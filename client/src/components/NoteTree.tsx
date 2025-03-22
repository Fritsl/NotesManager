import { useState } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import { Note } from "@/types/notes";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function NoteTree() {
  const { notes, addNote } = useNotes();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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

  const isExpanded = (noteId: string) => {
    return expandedNodes.has(noteId);
  };

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

import { useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import DropZone from "./DropZone";
import { Button } from "@/components/ui/button";
import { Plus, FilePlus, RotateCcw } from "lucide-react";
import { getProject } from "@/lib/projectService";

export default function NoteTree() {
  const { 
    notes, 
    addNote, 
    expandedNodes, 
    toggleExpand, 
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel,
    currentProjectName,
    setCurrentProjectName,
    currentProjectId,
    hasActiveProject,
    maxDepth,
    canUndo,
    undoLastAction,
    getUndoDescription
  } = useNotes();
  
  // Monitor current project name for debugging
  useEffect(() => {
    console.log("NoteTree - Current Project Name:", currentProjectName);
  }, [currentProjectName]);
  
  // Add safeguard to ensure project name is always synced with database
  useEffect(() => {
    // Ensure project name isn't empty when it should have a value
    if (hasActiveProject && currentProjectId && (!currentProjectName || currentProjectName.trim() === '')) {
      console.warn('Project name missing when it should have a value - requesting refresh');
      // This might trigger a database name restore if the app has the ID but lost the name
      getProject(currentProjectId).then((project) => {
        if (project && project.name) {
          console.log('Name mismatch detected - correcting from', 
            `"${currentProjectName}" to database value "${project.name}"`
          );
          setCurrentProjectName(project.name);
        }
      });
    }
  }, [currentProjectName, hasActiveProject, currentProjectId, setCurrentProjectName]);

  // Check if a node is expanded
  const isExpanded = (noteId: string) => {
    return expandedNodes.has(noteId);
  };
  
  // Expand one more level, but cap at maxDepth
  const expandMoreLevel = () => {
    console.log(`Expand more level: current=${currentLevel}, max=${maxDepth}`);
    // Ensure we don't exceed the maximum depth of the hierarchy
    const newLevel = Math.min(currentLevel + 1, maxDepth);
    console.log(`Setting new level to: ${newLevel}`);
    expandToLevel(newLevel);
  };
  
  // Collapse one level
  const collapseOneLevel = () => {
    console.log(`Collapse one level: current=${currentLevel}`);
    // Don't allow collapsing below level 0 (fully collapsed)
    if (currentLevel > 0) {
      const newLevel = currentLevel - 1;
      console.log(`Setting new level to: ${newLevel}`);
      expandToLevel(newLevel);
    } else {
      // If already at level 0, ensure it's properly collapsed
      console.log(`Already at level 0, ensuring it's collapsed`);
      expandToLevel(0);
    }
  };
  
  // Set up keyboard shortcuts for expand/collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input or textarea, don't handle keyboard shortcuts
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      
      // Check if we have notes
      const hasNotes = notes.length > 0;
      
      // Ctrl+E to expand all - only if we have notes
      if (e.ctrlKey && e.key === 'e') {
        // Only prevent default if we have notes to expand
        if (hasNotes) {
          e.preventDefault();
          expandAll();
        }
        // If no notes, allow the browser to handle normally (for menu shortcuts)
      }
      
      // Ctrl+C to collapse all
      if (e.ctrlKey && e.key === 'c') {
        // Skip if the user is trying to copy text
        if (window.getSelection()?.toString()) return;
        
        // Only prevent default if we have notes to collapse
        if (hasNotes) {
          e.preventDefault();
          collapseAll();
        }
        // If no notes, allow the browser to handle normally
      }
      
      // Z - Collapse one level (no modifier needed - dedicated keys for tree navigation)
      if (e.key === 'z' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Only prevent default if we have notes
        if (hasNotes) {
          e.preventDefault();
          collapseOneLevel();
        }
        // If no notes, allow the key to function normally
      }
      
      // X - Expand one more level
      if (e.key === 'x' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Only prevent default if we have notes
        if (hasNotes) {
          e.preventDefault();
          expandMoreLevel();
        }
        // If no notes, allow the key to function normally
      }
      
      // Number keys 0-5 with Ctrl to expand to specific levels
      if (e.ctrlKey && ['0', '1', '2', '3', '4', '5'].includes(e.key)) {
        // Only prevent default if we have notes
        if (hasNotes) {
          e.preventDefault();
          const level = parseInt(e.key);
          expandToLevel(level);
        }
        // If no notes, allow these key combinations to work normally
      }
      
      // Ctrl+Z for undo - this should work regardless of notes
      if (e.ctrlKey && e.key === 'z') {
        // Only prevent default if we actually have something to undo
        if (canUndo) {
          e.preventDefault();
          console.log('Undoing last action');
          undoLastAction();
        }
        // Otherwise let the browser handle it normally
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notes, expandAll, collapseAll, expandToLevel, currentLevel, maxDepth, expandMoreLevel, collapseOneLevel, canUndo, undoLastAction]);

  return (
    <div className="p-2">
      {hasActiveProject && (
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
            <div className="fixed inset-0 flex items-center justify-center">
              <Button
                variant="outline"
                onClick={() => addNote(null)}
                className="flex items-center"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add a note
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

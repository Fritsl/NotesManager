import { useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import NoteTreeItem from "./NoteTreeItem";
import AnimatedNoteTreeItem from "./AnimatedNoteTreeItem";
import DropZone from "./DropZone";
import { Button } from "@/components/ui/button";
import { Plus, FilePlus, RotateCcw } from "lucide-react";
import { getProject } from "@/lib/projectService";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
      
      // Number keys 0-5 with Ctrl to expand to specific levels
      // Keep these as they can be convenient for quick jumps
      if (e.ctrlKey && ['0', '1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const level = parseInt(e.key);
        expandToLevel(level);
      }
      
      // Ctrl+Z for undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo) {
          console.log('Undoing last action');
          undoLastAction();
        }
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
          <AnimatePresence>
            {notes.map((note, index) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: index * 0.05 // Staggered animation
                }}
              >
                <AnimatedNoteTreeItem
                  note={note}
                  level={0}
                  toggleExpand={toggleExpand}
                  isExpanded={isExpanded(note.id)}
                  index={index}
                  isRoot={true}
                />
                <DropZone index={index + 1} />
              </motion.div>
            ))}
          </AnimatePresence>
          
          {notes.length === 0 && (
            <div className="flex items-center justify-center h-[calc(100vh-120px)]">
              <div className="text-center">
                <FilePlus className="h-10 w-10 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-500 mb-4">No notes in this project yet</p>
                <Button
                  variant="outline"
                  onClick={() => addNote(null)}
                  className="flex items-center mx-auto"
                  size="lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add a note
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

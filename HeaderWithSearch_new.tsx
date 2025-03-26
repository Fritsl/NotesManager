import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { 
  Menu, 
  FileUp, 
  FileDown, 
  ChevronUp, 
  ChevronDown,
  Info,
  Check,
  X,
  Edit2,
  Save,
  FileText,
  FolderOpen,
  LogOut,
  LogIn,
  Edit,
  FileEdit,
  Trash2,
  AlertTriangle,
  HelpCircle,
  Presentation, 
  Play,         
  Maximize2,    
  Minimize2,
  PlusCircle,
  FilePlus,
  RotateCcw
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import ProjectsModal from "@/components/ProjectsModal";
import PayoffModal from "@/components/PayoffModal";
import ProjectDescriptionModal from "@/components/ProjectDescriptionModal";
import HelpModal from "@/components/HelpModal";
import AuthModal from "@/components/AuthModal";
import UserMenu from "@/components/UserMenu";
import SearchBar from "@/components/SearchBar";
import FilterMenu, { FilterType } from "@/components/FilterMenu";
import { Note } from "@/types/notes";
import { 
  moveProjectToTrash, 
  updateProject, 
  generateUniqueProjectName 
} from "@/lib/projectService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { levelColors } from "@/lib/level-colors";
import screenfull from 'screenfull';

export default function HeaderWithSearch() {
  const { 
    notes,
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel,
    maxDepth,
    currentProjectName,
    setCurrentProjectName,
    hasActiveProject,
    setHasActiveProject,
    createNewProject,
    saveProject,
    currentProjectId,
    addNote,
    undoLastAction,
    canUndo,
    getUndoDescription,
    exportNotes,
    exportCurrentLevelAsText
  } = useNotes();

  // For filter functionality
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);

  // Handle filter change
  const handleFilterChange = (filtered: Note[], type: FilterType) => {
    setFilteredNotes(filtered);
    setActiveFilter(type);

    // Dispatch a custom event for NotesEditor to listen for
    const filterEvent = new CustomEvent('filter-change', { 
      detail: { filteredNotes: filtered, filterType: type } 
    });
    window.dispatchEvent(filterEvent);

    // Update document title when applying a filter
    if (type) {
      document.title = `Filtered Notes - ${currentProjectName || "Notes"}`;
    } else {
      document.title = currentProjectName || "Notes";
    }
  };
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Success",
        description: "You have been logged out",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  // Remove debug log
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showPayoffModal, setShowPayoffModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState(currentProjectName || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  // Update local state when context project name changes
  useEffect(() => {
    setEditedProjectName(currentProjectName || '');
  }, [currentProjectName]);

  // Focus input when edit mode is enabled
  useEffect(() => {
    if (isEditingProjectName && projectNameInputRef.current) {
      projectNameInputRef.current.focus();
      projectNameInputRef.current.select();
    }
  }, [isEditingProjectName]);

  // Add global keyboard shortcut for Viewer (I key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in a text input or textarea field
      const target = e.target as HTMLElement;
      const isEditingText = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      // Only trigger if 'I' key is pressed and we're not editing text
      if (!isEditingText && e.key.toLowerCase() === 'i') {
        window.open("https://fastpresenterviwer.netlify.app", "_self");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const startEditing = () => {
    setIsEditingProjectName(true);
  };

  const saveProjectName = () => {
    // Don't allow empty project names
    if (editedProjectName.trim() === '') {
      setEditedProjectName(currentProjectName);
      setIsEditingProjectName(false);
      return;
    }

    // Additional validation to ensure we have a project ID
    if (!currentProjectId) {
      toast({
        title: "No Active Project",
        description: "Please create or select a project first",
        variant: "destructive",
      });
      return;
    }

    // If the project name hasn't actually changed, just exit edit mode
    if (editedProjectName === currentProjectName) {
      setIsEditingProjectName(false);
      return;
    }

    // Update the project name in the context
    setCurrentProjectName(editedProjectName);
    setIsEditingProjectName(false);

    // Log the name change for debugging
    console.log(`Project name changed from "${currentProjectName}" to "${editedProjectName}"`);

    // Save the project name directly to the database
    if (currentProjectId) {
      // Use the exportNotes function we already have
      const notesData = exportNotes();
      
      console.log("Directly saving project name change to database");
      
      (async () => {
        try {
          // Call updateProject directly to update the database
          const result = await updateProject(
            currentProjectId,
            editedProjectName,
            notesData
          );
          
          if (result) {
            console.log("Project name updated successfully in database");
            // Update the context state to keep names in sync
            setCurrentProjectName(editedProjectName);
            // Trigger a refresh of any project listings
            window.dispatchEvent(new Event('project-updated'));
          } else {
            console.error("Failed to update project name in database");
          }
        } catch (error) {
          console.error("Error updating project name in database:", error);
        }
      })();
    }
  };

  const cancelEditing = () => {
    setEditedProjectName(currentProjectName);
    setIsEditingProjectName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveProjectName();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };
  
  // Handle exporting the current level as text
  const handleExportAsText = () => {
    if (hasActiveProject) {
      const text = exportCurrentLevelAsText();
      // Use the Clipboard API to copy text to clipboard
      navigator.clipboard.writeText(text)
        .then(() => {
          toast({
            title: "Copied to Clipboard",
            description: `All visible notes exported as text (${text.length} characters)`
          });
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          toast({
            title: "Export Failed",
            description: "Could not copy to clipboard. Try again or use a different browser.",
            variant: "destructive"
          });
        });
    } else {
      toast({
        title: "No Active Project",
        description: "Please create or open a project first",
        variant: "destructive"
      });
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(screenfull.isFullscreen);
    };

    if (screenfull.isEnabled) {
      screenfull.on('change', handleFullscreenChange);
    }

    return () => {
      if (screenfull.isEnabled) {
        screenfull.off('change', handleFullscreenChange);
      }
    };
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (screenfull.isEnabled) {
      screenfull.toggle();
    }
  };

  // Return your JSX here
  // ...
}
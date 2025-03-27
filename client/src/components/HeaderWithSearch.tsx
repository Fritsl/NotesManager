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

  // Return JSX 
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2 flex-1">
        {/* Project name heading (or edit input) */}
        <div className="flex-1 min-w-0">
          {isEditingProjectName ? (
            <div className="flex items-center space-x-2">
              <Input
                ref={projectNameInputRef}
                value={editedProjectName}
                onChange={(e) => setEditedProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9"
                placeholder="Enter project name..."
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={saveProjectName}
                className="text-green-500 hover:text-green-700"
              >
                <Check size={18} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEditing}
                className="text-red-500 hover:text-red-700"
              >
                <X size={18} />
              </Button>
            </div>
          ) : (
            <>
              {hasActiveProject ? (
                <div className="flex items-center space-x-2">
                  <h1 
                    className="text-lg font-semibold truncate cursor-pointer hover:text-primary/80"
                    onClick={startEditing}
                    title="Click to edit project name"
                  >
                    {currentProjectName || "Untitled Project"}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startEditing}
                    className="h-8 w-8 text-gray-400 hover:text-primary p-1"
                    title="Edit project name"
                  >
                    <Edit2 size={16} />
                  </Button>
                </div>
              ) : (
                <h1 className="text-lg font-semibold text-muted-foreground">No Project Open</h1>
              )}
            </>
          )}
        </div>

        {/* Search bar */}
        <div className="hidden md:block w-80">
          <SearchBar />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Import/Export Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Import/Export">
                <FileText size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setShowImportModal(true)} 
                className="cursor-pointer"
              >
                <FileUp className="mr-2 h-4 w-4" />
                <span>Import</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowExportModal(true)} 
                className="cursor-pointer"
              >
                <FileDown className="mr-2 h-4 w-4" />
                <span>Export</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleExportAsText} 
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Export Level as Text</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Undo button (visible only when undo is available) */}
          {canUndo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={undoLastAction} 
                    title={getUndoDescription()}
                    className="relative"
                  >
                    <RotateCcw size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{getUndoDescription()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Projects Menu */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowProjectsModal(true)}
            title="Projects"
          >
            <FolderOpen size={20} />
          </Button>

          {/* Fullscreen Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </Button>

          {/* Help button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowHelpModal(true)}
            title="Help"
          >
            <HelpCircle size={20} />
          </Button>

          {/* Filter menu */}
          <div className="hidden md:block">
            <FilterMenu onFilterChange={handleFilterChange} />
          </div>

          {/* User menu (sign in/out) */}
          <UserMenu />
        </div>
      </div>

      {/* Modals */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
      {showProjectsModal && <ProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} />}
      {showPayoffModal && <PayoffModal isOpen={showPayoffModal} onClose={() => setShowPayoffModal(false)} />}
      {showDescriptionModal && <ProjectDescriptionModal isOpen={showDescriptionModal} onClose={() => setShowDescriptionModal(false)} />}
      {showHelpModal && <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />}
      {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}
      
      {/* New Project Creation Dialog */}
      <AlertDialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Project</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for your new project
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              ref={newProjectInputRef}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newProjectName.trim() !== '') {
                    createNewProject(newProjectName);
                    setShowNewProjectDialog(false);
                    setNewProjectName('');
                  }
                }
              }}
              className="w-full"
              placeholder="Project name"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewProjectName('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (newProjectName.trim() !== '') {
                  createNewProject(newProjectName);
                  setNewProjectName('');
                }
              }}
              disabled={newProjectName.trim() === ''}
            >
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{currentProjectName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (currentProjectId) {
                  try {
                    const result = await moveProjectToTrash(currentProjectId);
                    if (result) {
                      toast({
                        title: "Project Moved to Trash",
                        description: "The project has been moved to the trash bin."
                      });
                      setHasActiveProject(false);
                      setCurrentProjectName('');
                      setCurrentProjectId(null);
                      setNotes([]);
                    } else {
                      toast({
                        title: "Error",
                        description: "Failed to delete the project.",
                        variant: "destructive",
                      });
                    }
                  } catch (error) {
                    console.error("Error deleting project:", error);
                    toast({
                      title: "Error",
                      description: "An unexpected error occurred.",
                      variant: "destructive",
                    });
                  }
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
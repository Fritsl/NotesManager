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

  // Add global keyboard shortcuts for Viewer (I key) and Undo (Ctrl+Z)
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
      
      // Add shortcut for undo (Ctrl+Z) when not editing text
      if (!isEditingText && e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && canUndo) {
        e.preventDefault(); // Prevent default browser undo
        undoLastAction();
        toast({
          title: "Undo Complete",
          description: "Last action has been undone",
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canUndo, undoLastAction, toast]);

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
    if (currentProjectId) {
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

  return (
    <header className="bg-gray-950 border-b border-gray-800 py-2 px-2 sm:px-4">
      <div className="flex flex-col space-y-2">
        {/* Top row with project name and controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="flex items-center">
              {!isEditingProjectName ? (
                <div 
                  className="flex items-center cursor-pointer group"
                  onClick={startEditing}
                >
                  <h1 className="mobile-text-base font-semibold text-gray-100 flex items-center">
                    <span className="text-gray-400 hidden sm:inline">Project:</span>
                    <span className="ml-0 sm:ml-1 max-w-[120px] sm:max-w-[250px] truncate group-hover:text-primary transition-colors">
                      {currentProjectName || "Untitled Project"}
                    </span>
                    <Edit2 className="h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                  </h1>
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="text-gray-400 text-sm sm:text-base mr-1 hidden sm:inline">Project:</span>
                  <div className="flex items-center">
                    <Input
                      ref={projectNameInputRef}
                      value={editedProjectName}
                      onChange={(e) => {
                        // Filter out non-ASCII characters and problematic characters that database restricts
                        const rawInput = e.target.value;
                        const filteredInput = rawInput.replace(/[^\x00-\x7F]|[<>{}[\]\\\/]/g, '');
                        
                        // Show a warning if characters were filtered out
                        if (filteredInput !== rawInput) {
                          toast({
                            title: 'Character Removed',
                            description: 'Some characters are not allowed in project names due to database constraints.',
                            duration: 3000
                          });
                        }
                        
                        setEditedProjectName(filteredInput);
                      }}
                      onKeyDown={handleKeyDown}
                      className="h-7 py-0 w-28 sm:w-auto text-sm sm:text-base font-semibold bg-gray-800 border-gray-700 focus-visible:ring-primary text-gray-100"
                      maxLength={50}
                      placeholder="ASCII chars only"
                    />
                    <div className="flex ml-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 p-0 text-green-500 hover:text-green-400 hover:bg-gray-800 touch-target"
                        onClick={saveProjectName}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-400 hover:bg-gray-800 touch-target"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Level Controls (added to top menu) */}
            <div className="flex items-center gap-1 ml-4">
              {Array.from({ length: Math.min(maxDepth + 1, 9) }, (_, i) => i).map(level => {
                const colorTheme = levelColors[Math.min(level, levelColors.length - 1)];
                return (
                  <Button 
                    key={level}
                    variant="outline" 
                    size="sm"
                    onClick={() => expandToLevel(level)}
                    className={cn(
                      "h-7 w-7 p-0 font-bold text-white",
                      level > 0 ? "ml-1" : "",
                      `${colorTheme.bg} border ${colorTheme.border}`,
                      currentLevel === level ? 'ring-2 ring-white' : ''
                    )}
                  >
                    {level}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            {/* Viewer Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2 text-primary-500 hover:text-primary-400"
                    onClick={() => {
                      window.open("https://fastpresenterviwer.netlify.app", "_self");
                    }}
                  >
                    <Presentation className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Viewer</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open Presenter Viewer (Shortcut: I)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Fullscreen Toggle Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleFullscreen}
                    className={`ml-2 p-1 rounded-full hover:bg-black/20 transition-colors ${isFullscreen ? 'text-primary' : 'text-gray-400'}`}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <Maximize2 className="h-5 w-5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Second row with search and actions */}
        <div className="flex justify-between items-center">
          <div className="flex-1 flex items-center space-x-2">
            {/* Left side - Hamburger menu and Search */}
            <div className="flex-shrink-0 flex items-center">
              {/* Hamburger Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 p-0 touch-target">
                    <Menu className="h-5 w-5 text-gray-300" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-gray-900 border-gray-800 text-gray-300">
                  {/* Project Management */}
                  <DropdownMenuItem 
                    onClick={() => setShowProjectsModal(true)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Project
                  </DropdownMenuItem>
                  
                  {/* Only enable these when a project is active */}
                  <DropdownMenuItem 
                    onClick={() => {
                      if (currentProjectId) {
                        saveProject().then(() => {
                          toast({
                            title: "Project Saved",
                            description: "Your project has been saved successfully",
                          });
                        });
                      } else {
                        toast({
                          title: "No Active Project",
                          description: "Please create or select a project first",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Project
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={() => {
                      // Generate a name for the new project
                      (async () => {
                        const defaultName = await generateUniqueProjectName();
                        setNewProjectName(defaultName);
                        setShowNewProjectDialog(true);
                      })();
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Project
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => setShowDescriptionModal(true)}
                  >
                    <FileEdit className="h-4 w-4 mr-2" />
                    Edit Description
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Import/Export */}
                  <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                    <FileUp className="h-4 w-4 mr-2" />
                    Import Notes
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Export Notes
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={handleExportAsText}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Copy as Text
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Layout options */}
                  <DropdownMenuItem onClick={expandAll}>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Expand All
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={collapseAll}>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Collapse All
                  </DropdownMenuItem>
                  
                  {canUndo && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={undoLastAction}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {getUndoDescription()}
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {/* Move to trash option - only enabled if project exists */}
                  <DropdownMenuItem 
                    onClick={() => {
                      if (currentProjectId) {
                        setShowDeleteConfirm(true);
                      } else {
                        toast({
                          title: "No Active Project",
                          description: "Please create or select a project first",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Move to Trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 flex items-center space-x-2">
              <div className="flex-grow">
                <SearchBar />
              </div>
              
              {/* Filter Menu */}
              <FilterMenu onFilterChange={handleFilterChange} />
              
              {/* Help Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 p-0 touch-target"
                      onClick={() => setShowHelpModal(true)}
                    >
                      <HelpCircle className="h-5 w-5 text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Help & Keyboard Shortcuts</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Adds User Menu */}
            <div className="flex-shrink-0">
              {user ? (
                <UserMenu 
                  displayName={user.email || "User"} 
                  handleSignOut={handleSignOut}
                />
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAuthModal(true)}
                  className="h-8 text-gray-100 hover:text-white"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  <span>Login</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
      <ExportModal onClose={() => setShowExportModal(false)} isOpen={showExportModal} />
      <ProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} />
      <PayoffModal isOpen={showPayoffModal} onClose={() => setShowPayoffModal(false)} />
      <ProjectDescriptionModal isOpen={showDescriptionModal} onClose={() => setShowDescriptionModal(false)} />
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      
      {/* Alert for delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Move project to trash?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will move "{currentProjectName}" to the trash. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-600 text-white"
              onClick={async () => {
                // Handle the trash action here
                if (currentProjectId) {
                  try {
                    await moveProjectToTrash(currentProjectId);
                    toast({
                      title: "Project Moved to Trash",
                      description: `"${currentProjectName}" has been moved to trash`,
                    });
                    // Reset current project
                    setCurrentProjectId(null);
                    setHasActiveProject(false);
                    setCurrentProjectName('');
                    // Clear notes
                    setNotes([]);
                  } catch (error) {
                    console.error("Error moving project to trash:", error);
                    toast({
                      title: "Error",
                      description: "Failed to move project to trash",
                      variant: "destructive",
                    });
                  }
                }
              }}
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* New Project Dialog */}
      <AlertDialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Create New Project</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Enter a name for your new project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              ref={newProjectInputRef}
              className="bg-gray-800 border-gray-700 text-gray-100"
              placeholder="Project Name"
              value={newProjectName}
              onChange={(e) => {
                // Filter non-ASCII characters
                const filteredInput = e.target.value.replace(/[^\x00-\x7F]|[<>{}[\]\\\/]/g, '');
                
                // Show warning if characters were filtered
                if (filteredInput !== e.target.value) {
                  toast({
                    title: 'Character Removed',
                    description: 'Some characters are not allowed in project names.',
                    duration: 3000
                  });
                }
                
                setNewProjectName(filteredInput);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (newProjectName.trim()) {
                    createNewProject(newProjectName.trim());
                    setShowNewProjectDialog(false);
                  }
                }
              }}
              maxLength={50}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => {
                if (newProjectName.trim()) {
                  createNewProject(newProjectName.trim());
                }
              }}
              disabled={!newProjectName.trim()}
            >
              Create Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
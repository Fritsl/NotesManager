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
      // No toast for successful logout
      console.log("User logged out successfully");
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
        // No toast for successful undo
        console.log("Undo action completed");
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
    if (hasActiveProject) {
      const text = exportCurrentLevelAsText();
      // Use the Clipboard API to copy text to clipboard
      navigator.clipboard.writeText(text)
        .then(() => {
          // No toast for successful clipboard operations
          console.log(`Copied to clipboard: ${text.length} characters`);
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
      {hasActiveProject ? (
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
                        {currentProjectName}
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
                          className="h-6 w-6 p-0 hover:bg-gray-800 touch-target"
                          onClick={saveProjectName}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 p-0 hover:bg-gray-800 touch-target"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Level Controls - Show inline if 3 or fewer levels (0, 1, 2) */}
              {maxDepth <= 2 ? (
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
              ) : null}
            </div>
            
            {/* For projects with more than 3 levels, show level buttons in a separate row below project name */}
            {maxDepth > 2 && (
              <div className="flex justify-center w-full mt-1 mb-1">
                <div className="flex flex-wrap items-center gap-1 px-1">
                  {Array.from({ length: Math.min(maxDepth + 1, 9) }, (_, i) => i).map(level => {
                    const colorTheme = levelColors[Math.min(level, levelColors.length - 1)];
                    return (
                      <Button 
                        key={level}
                        variant="outline" 
                        size="sm"
                        onClick={() => expandToLevel(level)}
                        className={cn(
                          "h-6 w-6 p-0 font-bold text-white",
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
            )}
            <div className="flex items-center">

              {/* Fullscreen Toggle Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleFullscreen}
                      className={`ml-2 p-1 rounded-full hover:bg-black/20 transition-colors text-gray-400 ${
                        isFullscreen ? 'opacity-20 hover:opacity-60' : 'opacity-50 hover:opacity-100'
                      } py-2`}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle Fullscreen Mode</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Consolidated Hamburger Menu - Removed mobile level controls */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 touch-target">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* File Operations */}
                  <DropdownMenuItem onClick={() => {
                    createNewProject('New Project');
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    <span>New</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowProjectsModal(true)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    <span>Projects</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    if (currentProjectId) {
                      try {
                        await saveProject();
                        // Toast will be shown by saveProject function
                      } catch (err) {
                        toast({
                          title: "Error",
                          description: "Failed to save project data",
                          variant: "destructive",
                        });
                      }
                    } else {
                      toast({
                        title: "No Project",
                        description: "Cannot save - no active project",
                        variant: "destructive",
                      });
                    }
                  }}>
                    <Save className="h-4 w-4 mr-2" />
                    <span className="font-semibold">Save Project</span>
                    <span className="ml-auto text-xs text-gray-400">{currentProjectId ? "(All Notes)" : "(No Project)"}</span>
                  </DropdownMenuItem>

                  {/* Note Actions */}
                  
                  {/* Show Undo option only when there's something to undo */}
                  {canUndo && (
                    <DropdownMenuItem onClick={() => {
                      undoLastAction();
                      // No toast for successful undo
                      console.log("Undo completed successfully");
                    }}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      <span>Undo: {getUndoDescription()}</span>
                    </DropdownMenuItem>
                  )}

                  {/* Always show the separator when there's an active project */}
                  {hasActiveProject && <DropdownMenuSeparator />}

                  {/* Import/Export */}
                  <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                    <FileUp className="h-4 w-4 mr-2" />
                    <span>Import from JSON</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    <span>Export JSON</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleExportAsText}
                    disabled={!hasActiveProject}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <span>Export Level as Text</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {/* User Options - Incorporating UserMenu items here */}
                  <DropdownMenuItem onClick={() => setShowPayoffModal(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    <span>Edit Profile Payoff</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDescriptionModal(true)}>
                    <FileEdit className="h-4 w-4 mr-2" />
                    <span>Edit Project Description</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      if (currentProjectId) {
                        setShowDeleteConfirm(true);
                      }
                    }}
                    disabled={!currentProjectId}
                    className="hover:bg-gray-700 focus:bg-gray-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete Project</span>
                  </DropdownMenuItem>
                  

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={()=> {/*Add SearchBar here*/}}>
                    <span>Search</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={()=> {/*Add FilterMenu here*/}}>
                    <span>Filter</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowHelpModal(true)}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Help</span>
                  </DropdownMenuItem>
                  {user ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-default pb-2">
                        <span className="text-xs">{user.email}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="h-4 w-4 mr-2" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => setShowAuthModal(true)}>
                      <LogIn className="h-4 w-4 mr-2" />
                      <span>Sign In</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

        </div>
      ) : (
        <>
          {/* No Project UI */}
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-gray-100">
              Notes Editor
            </h1>
            <div className="flex items-center space-x-2">

              {/* Consolidated Hamburger Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 touch-target">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* File Operations */}
                  <DropdownMenuItem onClick={() => {
                    createNewProject('New Project');
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    <span>New</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowProjectsModal(true)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    <span>Projects</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  {/* Note Actions */}

                  {/* Undo Action - only shown when actions are available to undo */}
                  {canUndo && (
                    <DropdownMenuItem 
                      onClick={() => {
                        const undoDesc = getUndoDescription();
                        undoLastAction();
                        // No toast for successful undo
                        console.log(`Undo completed successfully: ${undoDesc}`);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      <span>{getUndoDescription()} (Ctrl+Z)</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  {/* Import/Export */}
                  <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                    <FileUp className="h-4 w-4 mr-2" />
                    <span>Import from JSON</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    <span>Export JSON</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleExportAsText}
                    disabled={!hasActiveProject}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <span>Export Level as Text</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  {/* User Options */}
                  <DropdownMenuItem onClick={() => setShowPayoffModal(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    <span>Edit Profile Payoff</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDescriptionModal(true)}
                    disabled={!hasActiveProject}
                  >
                    <FileEdit className="h-4 w-4 mr-2" />
                    <span>Edit Project Description</span>
                  </DropdownMenuItem>


                  <DropdownMenuItem onClick={()=> {/*Add SearchBar here*/}}>
                    <span>Search</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={()=> {/*Add FilterMenu here*/}}>
                    <span>Filter</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowHelpModal(true)}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Help</span>
                  </DropdownMenuItem>

                  {user ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-default pb-2">
                        <span className="text-xs">{user.email}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="h-4 w-4 mr-2" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => setShowAuthModal(true)}>
                      <LogIn className="h-4 w-4 mr-2" />
                      <span>Sign In</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
      {showProjectsModal && <ProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} />}
      {showPayoffModal && <PayoffModal isOpen={showPayoffModal} onClose={() => setShowPayoffModal(false)} />}
      {showDescriptionModal && <ProjectDescriptionModal isOpen={showDescriptionModal} onClose={() => setShowDescriptionModal(false)} />}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-gray-900 border border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-200 flex items-center">
              <Trash2 className="mr-2 h-5 w-5 text-gray-400" />
              Move to Trash
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              The project "{currentProjectName}" will be moved to trash. 
              You can restore it later from the Trash if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (currentProjectId) {
                  try {
                    const success = await moveProjectToTrash(currentProjectId);

                    if (success) {
                      // No toast for successful trash operation
                      console.log("Project successfully moved to trash");
                      setHasActiveProject(false);
                      localStorage.removeItem('lastProjectId');
                    } else {
                      toast({
                        title: 'Error',
                        description: 'Failed to move project to trash',
                        variant: 'destructive',
                      });
                    }
                  } catch (error) {
                    console.error('Error moving project to trash:', error);
                    toast({
                      title: 'Error',
                      description: 'An unexpected error occurred',
                      variant: 'destructive',
                    });
                  }
                }
              }}
              className="bg-red-900 hover:bg-red-800 text-gray-200 border-none"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* New Project Dialog */}
      <AlertDialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Create New Project</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Enter a name for your new project. The name must contain only ASCII characters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              ref={newProjectInputRef}
              value={newProjectName}
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
                
                setNewProjectName(filteredInput);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Handle project creation on Enter
                  if (newProjectName.trim() !== '') {
                    createNewProject(newProjectName.trim());
                    setShowNewProjectDialog(false);
                  }
                }
              }}
              className="w-full bg-gray-800 border-gray-700 text-gray-100"
              placeholder="Project name (ASCII characters only)"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (newProjectName.trim() !== '') {
                  createNewProject(newProjectName.trim());
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              Create Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
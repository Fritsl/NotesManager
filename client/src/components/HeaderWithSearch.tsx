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
import { moveProjectToTrash } from "@/lib/projectService";
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
    getUndoDescription
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
  const projectNameInputRef = useRef<HTMLInputElement>(null);

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

    // Trigger the auto-save functionality
    if (currentProjectId) {
      setTimeout(async () => {
        try {
          await saveProject();
          console.log("Project auto-saved after name change");

          // The toast was already removed as requested
          /*
          toast({
            title: "Project Renamed",
            description: "The project name has been updated and saved",
          });
          */
        } catch (error) {
          console.error("Failed to auto-save after name change:", error);
          /*
          toast({
            title: "Error Saving Project Name",
            description: "The name was changed but couldn't be saved to the database",
            variant: "destructive",
          });
          */
        }
      }, 0);
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
                        onChange={(e) => setEditedProjectName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-7 py-0 w-28 sm:w-auto text-sm sm:text-base font-semibold bg-gray-800 border-gray-700 focus-visible:ring-primary text-gray-100"
                        maxLength={50}
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
                        currentLevel === level 
                          ? `${colorTheme.highlight} border-2 shadow-md` 
                          : `opacity-70 hover:opacity-100 hover:${colorTheme.highlight} hover:border-2`
                      )}
                    >
                      {colorTheme.label}
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
                        toast({
                          title: "Saved",
                          description: "Project saved successfully",
                        });
                      } catch (err) {
                        toast({
                          title: "Error",
                          description: "Failed to save project",
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
                    <span>Save</span>
                    <span className="ml-auto text-xs text-muted-foreground">{currentProjectId ? "(Manual)" : "(No Project)"}</span>
                  </DropdownMenuItem>

                  {/* Note Actions */}
                  <DropdownMenuItem onClick={() => {
                    if (hasActiveProject) {
                      addNote(null);
                    } else {
                      toast({
                        title: "No Active Project",
                        description: "Please create or open a project first",
                        variant: "destructive"
                      });
                    }
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    <span>Add Note (Root level)</span>
                  </DropdownMenuItem>

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
                    className="text-red-500 hover:text-red-400 focus:text-red-400"
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
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
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
              {/* Viewer Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-1 text-primary-500 hover:text-primary-400"
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
                  <DropdownMenuItem 
                    onClick={() => {
                      if (hasActiveProject) {
                        addNote(null);
                      } else {
                        toast({
                          title: "No Active Project",
                          description: "Please create or open a project first",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={!hasActiveProject}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    <span>Add Note (Root level)</span>
                  </DropdownMenuItem>

                  {/* Undo Action - only shown when actions are available to undo */}
                  {canUndo && (
                    <DropdownMenuItem 
                      onClick={() => {
                        undoLastAction();
                        toast({
                          title: "Undo Successful",
                          description: "Previous action has been undone"
                        });
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      <span>{getUndoDescription()}</span>
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
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
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
              <Trash2 className="mr-2 h-5 w-5 text-red-500" />
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
                      toast({
                        title: 'Moved to Trash',
                        description: 'Project moved to trash successfully',
                      });
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
    </header>
  );
}
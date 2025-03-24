import { Button } from "@/components/ui/button";
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
  Edit,
  FileEdit
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import ProjectsModal from "@/components/ProjectsModal";
import PayoffModal from "@/components/PayoffModal";
import ProjectDescriptionModal from "@/components/ProjectDescriptionModal";
import SearchBar from "@/components/SearchBar";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { levelColors } from "@/lib/level-colors";

export default function Header() {
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
    currentProjectId
  } = useNotes();
  const { signOut } = useAuth();
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
  
  // Debug
  console.log("Header - Current Project Name:", currentProjectName);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showPayoffModal, setShowPayoffModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState(currentProjectName || '');
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
    
    // If the project name hasn't actually changed, just exit edit mode
    if (editedProjectName === currentProjectName) {
      setIsEditingProjectName(false);
      return;
    }
    
    // Update the project name in the context
    setCurrentProjectName(editedProjectName);
    setIsEditingProjectName(false);
    
    // Trigger the auto-save functionality
    if (currentProjectId) {
      setTimeout(async () => {
        try {
          await saveProject();
          console.log("Project auto-saved after name change");
          toast({
            title: "Project Renamed",
            description: "The project name has been updated and saved",
          });
        } catch (error) {
          console.error("Failed to auto-save after name change:", error);
          toast({
            title: "Error Saving Project Name",
            description: "The name was changed but couldn't be saved to the database",
            variant: "destructive",
          });
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 p-0 ml-1 hidden sm:flex">
                      <Info className="h-4 w-4 text-gray-400 hover:text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs bg-gray-900 border-gray-700">
                    <p className="font-medium mb-1">Keyboard Shortcuts:</p>
                    <ul className="list-disc ml-3 space-y-0.5">
                      <li><kbd className="px-1 bg-gray-800 rounded text-[9px] text-gray-200">Z</kbd> Collapse one level</li>
                      <li><kbd className="px-1 bg-gray-800 rounded text-[9px] text-gray-200">X</kbd> Expand one more level</li>
                      <li><kbd className="px-1 bg-gray-800 rounded text-[9px] text-gray-200">Ctrl+0</kbd> Collapse all (L0)</li>
                      <li><kbd className="px-1 bg-gray-800 rounded text-[9px] text-gray-200">Ctrl+1-5</kbd> Jump to levels L1-L5</li>
                      <li><kbd className="px-1 bg-gray-800 rounded text-[9px] text-gray-200">Ctrl+E</kbd> Expand all</li>
                      <li><kbd className="px-1 bg-gray-800 rounded text-[9px] text-gray-200">Ctrl+C</kbd> Collapse all</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center">
              {/* Level Controls */}
              <div className="hidden sm:flex items-center mr-2 border-r pr-3 border-gray-700 flex-wrap">
                {/* Create buttons for L0 through maxDepth */}
                {Array.from({ length: Math.min(maxDepth + 1, 9) }, (_, i) => i).map(level => {
                  // Get the color theme for this level - directly using the level as index
                  const colorTheme = levelColors[Math.min(level, levelColors.length - 1)];
                  console.log(`Rendering level button ${level}, current level: ${currentLevel}`);
                  return (
                    <Button 
                      key={level}
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        console.log(`Level button ${level} clicked, setting level to ${level}`);
                        expandToLevel(level);
                      }}
                      className={cn(
                        "h-7 w-7 p-0 font-bold text-white",
                        level > 0 ? "ml-1" : "", // Spacing between buttons
                        // Apply the level color - now with colors always showing but highlighted when active
                        `${colorTheme.bg} border ${colorTheme.border}`,
                        // Additional styling when the button is active
                        currentLevel === level 
                          ? `${colorTheme.highlight} border-2 shadow-md` 
                          : `opacity-70 hover:opacity-100 hover:${colorTheme.highlight} hover:border-2`
                      )}
                    >
                      {colorTheme.label} {/* Use the label from the color theme */}
                    </Button>
                  );
                })}
              </div>
              
              {/* Expand/Collapse Controls */}
              <div className="hidden sm:flex items-center mr-2 border-r pr-3 border-gray-700">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={collapseAll}
                  className="h-7 w-7 touch-target"
                  title="Collapse All"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={expandAll}
                  className="h-7 w-7 touch-target"
                  title="Expand All"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Consolidated Hamburger Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 touch-target">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Mobile-only Level Controls */}
                  <div className="sm:hidden p-2 border-b border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Level Controls</div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: Math.min(maxDepth + 1, 9) }, (_, i) => i).slice(0, 5).map(level => {
                        const colorTheme = levelColors[Math.min(level, levelColors.length - 1)];
                        return (
                          <Button 
                            key={level}
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              console.log(`Mobile level button ${level} clicked, setting level to ${level}`);
                              expandToLevel(level);
                              // Close dropdown on mobile after selecting
                              document.body.click();
                            }}
                            className={cn(
                              "h-8 w-8 p-0 font-bold text-white",
                              // Apply the level color - now with colors always showing but highlighted when active
                              `${colorTheme.bg} border ${colorTheme.border}`,
                              // Additional styling when the button is active
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
                    <div className="flex justify-between mt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          collapseAll();
                          document.body.click();
                        }}
                        className="h-8 px-2 text-xs"
                      >
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Collapse All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          expandAll();
                          document.body.click();
                        }}
                        className="h-8 px-2 text-xs"
                      >
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Expand All
                      </Button>
                    </div>
                  </div>

                  {/* File Operations */}
                  <DropdownMenuItem onClick={() => {
                    // Create a new project
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
                    // Manual save button for testing
                    if (currentProjectId) {
                      console.log("Manual save for project ID:", currentProjectId);
                      try {
                        await saveProject();
                        console.log("Manual save completed");
                      } catch (err) {
                        console.error("Manual save failed:", err);
                      }
                    } else {
                      console.warn("Cannot save - no project ID");
                    }
                  }}>
                    <Save className="h-4 w-4 mr-2" />
                    <span>Save</span>
                    <span className="ml-auto text-xs text-muted-foreground">{currentProjectId ? "(Manual)" : "(No Project)"}</span>
                  </DropdownMenuItem>
                  
                  {/* Debug button */}
                  <DropdownMenuItem onClick={() => {
                    // Use the debugInfo function already passed to this component from context
                    // Instead of trying to call useNotes() inside the event handler
                    const noteCount = Array.isArray(notes) ? notes.length : 0;
                    const debugData = {
                      currentProjectName,
                      currentProjectId, 
                      noteCount,
                      hasActiveProject
                    };
                    console.log("DEBUG INFO:", debugData);
                    
                    // Show debug info in toast
                    toast({
                      title: "Debug Info",
                      description: `Project: ${currentProjectName || 'None'}, ID: ${currentProjectId || 'None'}, Notes: ${noteCount}`,
                    });
                  }}>
                    <Info className="h-4 w-4 mr-2" />
                    <span>Debug Info</span>
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
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Search bar in the middle */}
          <div className="w-full">
            <SearchBar />
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
                    // Create a new project with default name
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
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
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
    </header>
  );
}
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
  Image,
  UploadCloud
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import ProjectsModal from "@/components/ProjectsModal";
import { migrateLocalImages } from "@/lib/projectService";
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

  // Project state initialization
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
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

            </div>
            <div className="flex items-center">
              {/* Level Controls */}
            <div className="hidden sm:flex items-center mr-2 border-r pr-3 border-gray-700 flex-wrap">
              {/* Create buttons for L0 through maxDepth */}
              {Array.from({ length: Math.min(maxDepth + 1, 9) }, (_, i) => i).map(level => {
                // Get the color theme for this level - directly using the level as index
                const colorTheme = levelColors[Math.min(level, levelColors.length - 1)];
                return (
                  <Button 
                    key={level}
                    variant="outline" 
                    size="sm"
                    onClick={() => expandToLevel(level)}
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
                  // Manual save button
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

                {/* Tools & Utilities */}
                <DropdownMenuItem onClick={async () => {
                  // Image Migration
                  if (currentProjectId) {
                    try {
                      toast({
                        title: "Processing",
                        description: "Migrating images to cloud storage...",
                      });

                      const result = await migrateLocalImages(currentProjectId);

                      if (result && result.migrated > 0) {
                        toast({
                          title: "Migration Complete",
                          description: `${result.migrated} images migrated to cloud storage`,
                        });
                      } else {
                        toast({
                          title: "No Changes",
                          description: "No images needed migration",
                        });
                      }
                    } catch (err) {
                      console.error("Migration error:", err);
                      toast({
                        title: "Error",
                        description: "Failed to migrate images",
                        variant: "destructive",
                      });
                    }
                  } else {
                    toast({
                      title: "No Project",
                      description: "Cannot migrate images - no active project",
                      variant: "destructive",
                    });
                  }
                }}>
                  <UploadCloud className="h-4 w-4 mr-2" />
                  <span>Migrate Images to Cloud</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                {/* User Options - Incorporating UserMenu items here */}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bottom row with search */}
          <div className="flex">
            <SearchBar />
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <h1 className="text-base sm:text-lg font-semibold text-gray-100">Parenting Notes App</h1>

          <div className="flex items-center space-x-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={() => createNewProject('New Project')}
              className="h-8 px-2 sm:px-3 text-xs sm:text-sm touch-target"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              New Project
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowProjectsModal(true)}
              className="h-8 px-2 sm:px-3 text-xs sm:text-sm touch-target"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              Open Project
            </Button>

            {/* Hamburger menu for mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 touch-target">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">

                {/* User Options - Incorporating UserMenu items here */}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      {showProjectsModal && (
        <ProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} />
      )}
    </header>
  );
}
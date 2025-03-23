import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { 
  Menu, 
  FileUp, 
  FileDown, 
  PlusCircle, 
  ChevronUp, 
  ChevronDown,
  Info,
  Check,
  X,
  Edit2,
  Save,
  FileText,
  FolderOpen,
  LogOut
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import ProjectsModal from "@/components/ProjectsModal";
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
    addNote, 
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel,
    maxDepth,
    currentProjectName,
    setCurrentProjectName,
    hasActiveProject,
    setHasActiveProject,
    createNewProject
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
    
    setCurrentProjectName(editedProjectName);
    setIsEditingProjectName(false);
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
    <header className="bg-gray-950 border-b border-gray-800 py-2 px-4 flex justify-between items-center">
      {hasActiveProject ? (
        <>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              {!isEditingProjectName ? (
                <div 
                  className="flex items-center cursor-pointer group"
                  onClick={startEditing}
                >
                  <h1 className="text-base font-semibold text-gray-100 flex items-center">
                    <span className="text-gray-400">Project:</span>
                    <span className="ml-1 max-w-[250px] truncate group-hover:text-primary transition-colors">
                      {currentProjectName}
                    </span>
                    <Edit2 className="h-3.5 w-3.5 ml-1.5 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                  </h1>
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="text-gray-400 text-base mr-1">Project:</span>
                  <div className="flex items-center">
                    <Input
                      ref={projectNameInputRef}
                      value={editedProjectName}
                      onChange={(e) => setEditedProjectName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-7 py-0 text-base font-semibold bg-gray-800 border-gray-700 focus-visible:ring-primary text-gray-100"
                      maxLength={50}
                    />
                    <div className="flex ml-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 p-0 text-green-500 hover:text-green-400 hover:bg-gray-800"
                        onClick={saveProjectName}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-400 hover:bg-gray-800"
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 p-0 ml-1">
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
          <div className="flex items-center space-x-2">
            {/* Level Controls */}
            <div className="flex items-center mr-2 border-r pr-3 border-gray-700 flex-wrap">
              {/* Create buttons for L0 through maxDepth */}
              {Array.from({ length: maxDepth + 1 }, (_, i) => i).map(level => {
                // Get the color theme for this level - now directly using the level as index
                const colorTheme = levelColors[Math.min(level, levelColors.length - 1)];
                return (
                  <Button 
                    key={level}
                    variant="outline" 
                    size="sm"
                    onClick={() => expandToLevel(level)}
                    className={cn(
                      "h-7 w-7 p-0",
                      level > 0 ? "ml-1" : "", // Spacing between buttons
                      // Apply the level color - now checking if currentLevel matches exactly
                      currentLevel === level 
                        ? `${colorTheme.highlight} border-l-[3px] ${colorTheme.border} ${colorTheme.text}`
                        : `border border-gray-700 hover:${colorTheme.highlight} hover:${colorTheme.text} hover:border-l-[3px] hover:${colorTheme.border}`
                    )}
                  >
                    {colorTheme.label} {/* Use the label from the color theme */}
                  </Button>
                );
              })}
            </div>
            
            {/* Expand/Collapse Controls */}
            <div className="flex items-center mr-2 border-r pr-3 border-gray-700">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={collapseAll}
                className="h-7 w-7"
                title="Collapse All"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={expandAll}
                className="h-7 w-7"
                title="Expand All"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Add New Root Note Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addNote(null)}
              className="h-7 mr-2"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              Add Note
            </Button>
            
            {/* Consolidated Hamburger Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                  <span>Load</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  // Save project (currently auto-saved)
                }}>
                  <Save className="h-4 w-4 mr-2" />
                  <span>Save</span>
                  <span className="ml-auto text-xs text-muted-foreground">(Auto)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                
                {/* Import/Export */}
                <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                  <FileUp className="h-4 w-4 mr-2" />
                  <span>Import from JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                  <FileDown className="h-4 w-4 mr-2" />
                  <span>Export to JSON</span>
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
        </>
      ) : (
        <>
          {/* No Project UI */}
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-semibold text-gray-100">
              Notes Editor
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            
            {/* Consolidated Hamburger Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
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
                  <span>Load</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                
                {/* Import/Export */}
                <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                  <FileUp className="h-4 w-4 mr-2" />
                  <span>Import from JSON</span>
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
        </>
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
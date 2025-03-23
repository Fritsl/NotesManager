import { Button } from "@/components/ui/button";
import { useState } from "react";
import { 
  MoreVertical, 
  Menu, 
  FileUp, 
  FileDown, 
  PlusCircle, 
  ChevronUp, 
  ChevronDown,
  ChevronsUpDown,
  Info
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import UserMenu from "@/components/UserMenu";
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
import { cn } from "@/lib/utils";
import { levelColors } from "@/lib/level-colors";

export default function Header() {
  const { 
    addNote, 
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel,
    maxDepth
  } = useNotes();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 py-2 px-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <h1 className="text-base font-semibold text-gray-800">Notes Tree</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 p-0 ml-1">
                <Info className="h-4 w-4 text-gray-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-medium mb-1">Keyboard Shortcuts:</p>
              <ul className="list-disc ml-3 space-y-0.5">
                <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">Z</kbd> Collapse one level</li>
                <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">X</kbd> Expand one more level</li>
                <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">Ctrl+1-5</kbd> Jump to level</li>
                <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">Ctrl+E</kbd> Expand all</li>
                <li><kbd className="px-1 bg-gray-100 rounded text-[9px]">Ctrl+C</kbd> Collapse all</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center space-x-2">
        {/* Level Controls */}
        <div className="flex items-center mr-2 border-r pr-3 border-gray-200 flex-wrap">
          {Array.from({ length: Math.max(1, maxDepth) }, (_, i) => i + 1).map(level => {
            // Get the color theme for this level
            // Use level-1 to match colors with actual hierarchy level (0-based index)
            // This ensures L1 button shows L1 colors from the levelColors array
            const colorTheme = levelColors[level - 1];
            return (
              <Button 
                key={level}
                variant="outline" 
                size="sm"
                onClick={() => expandToLevel(level)}
                className={cn(
                  "h-7 w-7 p-0",
                  level > 1 ? "ml-1" : "",
                  // Apply the level color
                  currentLevel === level 
                    ? `${colorTheme.highlight} border-l-[3px] ${colorTheme.border} ${colorTheme.text}`
                    : `border hover:${colorTheme.highlight} hover:${colorTheme.text} hover:border-l-[3px] hover:${colorTheme.border}`
                )}
              >
                L{level}
              </Button>
            );
          })}
        </div>
        
        {/* Expand/Collapse Controls */}
        <div className="flex items-center mr-2 border-r pr-3 border-gray-200">
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
        
        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowImportModal(true)}>
              <FileUp className="h-4 w-4 mr-2" />
              <span>Import</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowExportModal(true)}>
              <FileDown className="h-4 w-4 mr-2" />
              <span>Export</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* User Menu */}
        <div className="ml-2">
          <UserMenu />
        </div>
      </div>

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}
    </header>
  );
}

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
  ChevronsUpDown
} from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { 
    addNote, 
    expandAll, 
    collapseAll, 
    expandToLevel, 
    currentLevel 
  } = useNotes();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 py-2 px-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <h1 className="text-base font-semibold text-gray-800">Notes Tree</h1>
      </div>
      <div className="flex items-center space-x-1">
        {/* Expand/Collapse Controls */}
        <div className="flex">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={collapseAll}
            className="h-8 w-8"
            title="Collapse All (Ctrl+C)"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={expandAll}
            className="h-8 w-8"
            title="Expand All (Ctrl+E)"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => expandToLevel(currentLevel < 3 ? currentLevel + 1 : 1)}
            className="h-8 w-8"
            title="Toggle Level"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </div>
        
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => addNote(null)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              <span>Add Root Note</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

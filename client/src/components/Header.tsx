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
      <div className="flex items-center space-x-2">
        {/* Level Controls */}
        <div className="flex items-center mr-2 border-r pr-3 border-gray-200 flex-wrap">
          {Array.from({ length: 9 }, (_, i) => i + 1).map(level => (
            <Button 
              key={level}
              variant="outline" 
              size="sm"
              onClick={() => expandToLevel(level)}
              className={`h-7 w-7 p-0 ${level > 1 ? 'ml-1' : ''} ${currentLevel === level ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              L{level}
            </Button>
          ))}
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

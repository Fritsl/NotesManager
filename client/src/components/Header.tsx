import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PlusCircle, FileUp, FileDown } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";

export default function Header() {
  const { addNote } = useNotes();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 py-2 px-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <h1 className="text-base font-semibold text-gray-800">Notes Tree</h1>
      </div>
      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowImportModal(true)}
          className="flex items-center space-x-1 h-7 text-xs"
        >
          <FileUp className="h-3 w-3" />
          <span>Import</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowExportModal(true)}
          className="flex items-center space-x-1 h-7 text-xs"
        >
          <FileDown className="h-3 w-3" />
          <span>Export</span>
        </Button>
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

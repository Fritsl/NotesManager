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
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <PlusCircle className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-gray-800">Notes Tree Editor</h1>
      </div>
      <div className="flex items-center space-x-3">
        <Button 
          variant="default" 
          onClick={() => setShowImportModal(true)}
          className="flex items-center space-x-2"
        >
          <FileUp className="h-4 w-4" />
          <span>Import</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setShowExportModal(true)}
          className="flex items-center space-x-2"
        >
          <FileDown className="h-4 w-4" />
          <span>Export</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => addNote(null)}
          title="Add Root Note"
        >
          <PlusCircle className="h-5 w-5" />
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

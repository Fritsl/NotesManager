import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/context/NotesContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Download } from "lucide-react";

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { exportNotes, saveAllNotes, isSaving } = useNotes();

  const handleExport = () => {
    const data = exportNotes();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "notes-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onClose();
  };

  const previewJson = JSON.stringify(exportNotes(), null, 2);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Export Notes</DialogTitle>
          <DialogDescription>
            Your notes will be exported as a JSON file.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="bg-gray-50 rounded-md p-4 max-h-96 mt-4">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {previewJson}
          </pre>
        </ScrollArea>
        
        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex justify-start">
            <Button 
              variant="outline" 
              onClick={async () => {
                await saveAllNotes();
                onClose();
              }}
              disabled={isSaving}
              className="bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <Database className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save to Supabase"}
            </Button>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

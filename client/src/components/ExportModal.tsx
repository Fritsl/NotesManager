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

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { exportNotes } = useNotes();

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
    <Dialog open={isOpen} onOpenChange={onClose}>
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
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleExport}>
            Download JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

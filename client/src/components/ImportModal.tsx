import { useState, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, FileUp, AlertCircle } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { NotesData } from "@/types/notes";
import { useToast } from "@/components/ui/use-toast";

interface ImportModalProps {
  onClose: () => void;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const { importNotes, setHasActiveProject, currentProjectName } = useNotes();
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>(
    currentProjectName || 
    (fileName ? fileName.replace(/\.json$/, '') : 'Imported Project')
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const baseName = file.name.replace(/\.json$/, '');
    setFileName(file.name);
    setProjectName(baseName); // Auto-set project name based on file name
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content) as NotesData;
        
        // Validate the data structure
        if (!parsedData.notes || !Array.isArray(parsedData.notes)) {
          throw new Error("Invalid notes format. Expected { notes: [] }");
        }
        
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        
        // Import the notes with project name and set active
        setHasActiveProject(true); // Set project as active
        importNotes(parsedData, projectName);
        onClose();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Invalid JSON format");
        toast({
          title: "Import Failed",
          description: "The file contains invalid JSON data",
          variant: "destructive",
        });
      }
    };
    
    reader.onerror = () => {
      setError("Error reading the file");
    };
    
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = () => {
    setIsHovering(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    
    const file = e.dataTransfer.files[0];
    if (!file || file.type !== "application/json") {
      setError("Please select a JSON file");
      return;
    }
    
    const baseName = file.name.replace(/\.json$/, '');
    setFileName(file.name);
    setProjectName(baseName); // Auto-set project name based on file name
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsedData = JSON.parse(content) as NotesData;
        
        // Validate the data structure
        if (!parsedData.notes || !Array.isArray(parsedData.notes)) {
          throw new Error("Invalid notes format. Expected { notes: [] }");
        }
        
        // Import the notes with project name and set active
        setHasActiveProject(true); // Set project as active
        importNotes(parsedData, projectName);
        onClose();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Invalid JSON format");
      }
    };
    
    reader.onerror = () => {
      setError("Error reading the file");
    };
    
    reader.readAsText(file);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Notes</DialogTitle>
          <DialogDescription>
            Select a JSON file containing notes structure to import.
          </DialogDescription>
        </DialogHeader>
        
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center mt-4 transition-colors
            ${isHovering ? 'border-primary bg-primary/5' : 'border-gray-300'}
            ${error ? 'border-red-300 bg-red-50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".json" 
            onChange={handleFileSelect} 
            className="hidden" 
            id="fileInput" 
          />
          <label 
            htmlFor="fileInput" 
            className="cursor-pointer flex flex-col items-center"
          >
            <FileUp className="h-10 w-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Click to select a file or drag and drop
            </p>
            {fileName && (
              <p className="mt-2 text-sm text-primary font-medium">{fileName}</p>
            )}
            {error && (
              <div className="mt-3 flex items-center text-red-500 text-sm">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>{error}</span>
              </div>
            )}
          </label>
        </div>
        
        {fileName && !error && (
          <div className="mt-4">
            <Label htmlFor="projectName" className="text-sm font-medium text-gray-700">
              Project Name
            </Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-1"
              placeholder="Enter project name"
            />
            <p className="mt-1 text-xs text-gray-500">
              The project will be created with this name
            </p>
          </div>
        )}
        
        <div className="mt-2 text-sm text-gray-500">
          <p>File should be a valid JSON with the notes array structure.</p>
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="default" 
            disabled={!fileName || !!error || !projectName.trim()}
            onClick={() => {
              if (fileName && !error && projectName.trim()) {
                // This re-reads the file, but the previous handlers already
                // validated it should be OK. In a production app, we might
                // store the parsed data to avoid re-reading.
                const file = fileInputRef.current?.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    try {
                      const content = e.target?.result as string;
                      const parsedData = JSON.parse(content) as NotesData;
                      
                      // Import with project name and set active
                      setHasActiveProject(true);
                      importNotes(parsedData, projectName);
                      onClose();
                    } catch (error) {
                      // Error handling is already done in the initial read
                    }
                  };
                  reader.readAsText(file);
                }
              }
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, FileUp, AlertCircle, Database, Cloud } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { NotesData } from "@/types/notes";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notesService } from "@/lib/supabase";

interface ImportModalProps {
  onClose: () => void;
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const { importNotes } = useNotes();
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("file");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const loadFromSupabase = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const notesData = await notesService.getNotes();
      
      if (!notesData || !notesData.notes) {
        throw new Error("No notes found in Supabase");
      }
      
      importNotes(notesData);
      toast({
        title: "Import Successful",
        description: "Notes have been loaded from Supabase",
      });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load notes from Supabase");
      toast({
        title: "Import Failed",
        description: "Could not load notes from Supabase",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
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
        
        // Import the notes
        importNotes(parsedData);
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
    
    setFileName(file.name);
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
        
        // Import the notes
        importNotes(parsedData);
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
            Import notes from a file or load from Supabase.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs 
          defaultValue="file" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="flex items-center">
              <FileUp className="h-4 w-4 mr-2" />
              From File
            </TabsTrigger>
            <TabsTrigger value="supabase" className="flex items-center">
              <Database className="h-4 w-4 mr-2" />
              From Supabase
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="file">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center mt-4 transition-colors
                ${isHovering ? 'border-primary bg-primary/5' : 'border-gray-300'}
                ${error && activeTab === 'file' ? 'border-red-300 bg-red-50' : ''}`}
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
                {error && activeTab === 'file' && (
                  <div className="mt-3 flex items-center text-red-500 text-sm">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span>{error}</span>
                  </div>
                )}
              </label>
            </div>
            
            <div className="mt-2 text-sm text-gray-500">
              <p>File should be a valid JSON with the notes array structure.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="supabase">
            <div className="border rounded-lg p-6 text-center mt-4">
              <div className="flex flex-col items-center">
                <Database className="h-16 w-16 text-blue-500 mb-3" />
                <h3 className="text-lg font-medium mb-2">Load from Supabase</h3>
                <p className="text-sm text-gray-500 mb-4">
                  This will load your previously saved notes from Supabase database.
                </p>
                
                {error && activeTab === 'supabase' && (
                  <div className="mt-1 mb-3 flex items-center text-red-500 text-sm">
                    <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                
                <Button 
                  variant="default" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
                  onClick={loadFromSupabase}
                >
                  {isLoading ? (
                    <>
                      <Cloud className="h-4 w-4 mr-2 animate-pulse" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Load Notes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {activeTab === 'file' && (
            <Button 
              variant="default" 
              disabled={!fileName || !!error}
              onClick={() => {
                if (fileName && !error) {
                  onClose();
                }
              }}
            >
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

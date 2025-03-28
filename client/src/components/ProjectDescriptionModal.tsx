import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import { useNotes } from '../context/NotesContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { PaintBucket } from 'lucide-react';

interface ProjectDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectDescriptionModal({ isOpen, onClose }: ProjectDescriptionModalProps) {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { 
    currentProjectDescription, 
    setCurrentProjectDescription,
    currentProjectColor,
    setCurrentProjectColor,
    saveProject,
    currentProjectName,
    currentProjectId
  } = useNotes();
  
  // Available colors - 5 options plus transparent (empty string)
  const colorOptions = [
    { value: "", label: "Default" },
    { value: "#4CAF50", label: "Green" },
    { value: "#2196F3", label: "Blue" },
    { value: "#FFC107", label: "Yellow" },
    { value: "#E91E63", label: "Pink" },
    { value: "#9C27B0", label: "Purple" }
  ];

  useEffect(() => {
    if (isOpen) {
      setDescription(currentProjectDescription || '');
      // No need to set current color as we're using the context value directly
    }
  }, [isOpen, currentProjectDescription]);

  const handleSave = async () => {
    if (!currentProjectId) {
      toast({
        title: 'Error',
        description: 'No project is currently selected',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // Update the project description in context
      console.log('Setting current project description to:', description);
      console.log('Before update - current description:', currentProjectDescription);
      setCurrentProjectDescription(description);
      
      // Save the project directly to the online database
      console.log('Direct save of project description to online database');
      const result = await saveProject();
      console.log('Project description save result:', result);
      console.log('After save - current description:', currentProjectDescription);
      
      // Minimal toast notification for better user feedback
      toast({
        title: 'Success',
        description: 'Project description saved',
      });
      onClose();
    } catch (error) {
      console.error('Error saving project description:', error);
      toast({
        title: 'Error',
        description: 'Failed to save project description',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Project Description</DialogTitle>
          <DialogDescription>
            Update the description for project "{currentProjectName}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Project color picker */}
          <div className="grid grid-cols-1 items-start gap-2">
            <Label htmlFor="color" className="text-left">
              Project Color
            </Label>
            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-5 border rounded-sm" 
                style={{ backgroundColor: currentProjectColor || 'transparent' }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <PaintBucket className="h-4 w-4" />
                    <span>Select</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {colorOptions.map((color) => (
                    <DropdownMenuItem
                      key={color.value}
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setCurrentProjectColor(color.value)}
                    >
                      <div 
                        className="w-4 h-4 border rounded-sm" 
                        style={{ backgroundColor: color.value || 'transparent' }}
                      />
                      <span>{color.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Project description */}
          <div className="grid grid-cols-1 items-start gap-2 mt-2">
            <Label htmlFor="description" className="text-left">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Enter project description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
              disabled={isLoading}
              maxLength={500}
            />
            <div className="text-xs text-right text-muted-foreground">
              {description.length}/500
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import { useNotes } from '../context/NotesContext';

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
    saveProject,
    currentProjectName,
    currentProjectId
  } = useNotes();

  useEffect(() => {
    if (isOpen) {
      setDescription(currentProjectDescription || '');
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
      setCurrentProjectDescription(description);
      
      // Save the project with updated description
      await saveProject();
      
      toast({
        title: 'Success',
        description: 'Project description updated successfully',
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
          <div className="grid grid-cols-1 items-start gap-4">
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
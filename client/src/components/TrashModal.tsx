import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { LoaderCircle, TrashIcon, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { 
  getTrashedProjects, 
  restoreProjectFromTrash, 
  permanentlyDeleteProject,
  Project 
} from '../lib/projectService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectRestored: () => void; // Callback to refresh project list after restore
}

export default function TrashModal({ isOpen, onClose, onProjectRestored }: TrashModalProps) {
  const [trashedProjects, setTrashedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchTrashedProjects();
    }
  }, [isOpen]);

  const fetchTrashedProjects = async () => {
    setLoading(true);
    try {
      const projects = await getTrashedProjects();
      setTrashedProjects(projects);
    } catch (error) {
      console.error('Error fetching trashed projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trashed projects',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (project: Project) => {
    try {
      const success = await restoreProjectFromTrash(project.id);
      
      if (success) {
        toast({
          title: 'Success',
          description: `Project "${project.name}" has been restored`,
        });
        fetchTrashedProjects();
        onProjectRestored(); // Refresh the main project list
      } else {
        toast({
          title: 'Error',
          description: 'Failed to restore project',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error restoring project:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const confirmPermanentDelete = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteConfirm(true);
  };

  const handlePermanentDelete = async () => {
    if (!projectToDelete) return;
    
    try {
      const success = await permanentlyDeleteProject(projectToDelete.id);
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Project permanently deleted',
        });
        await fetchTrashedProjects();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete project',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-800 pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-gray-400" />
              <span className="bg-gradient-to-r from-red-500 to-amber-500 bg-clip-text text-transparent">Trash</span>
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Projects moved to trash are kept here for recovery. You can restore them or delete permanently.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border border-gray-800 rounded-md p-4 bg-gray-900">
              <h3 className="font-medium mb-4 text-gray-300">Trashed Projects</h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : trashedProjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <TrashIcon className="h-12 w-12 mb-2 text-gray-700" />
                  <p>The trash is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trashedProjects.map((project) => (
                    <div 
                      key={project.id} 
                      className="p-3 border border-gray-800 rounded-md bg-gray-850 flex flex-col relative"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-gray-300">{project.name}</h4>
                          <p className="text-sm text-gray-500">
                            Deleted: {formatDate(project.deleted_at)}
                          </p>
                          {project.description && (
                            <p className="text-sm text-gray-400 mt-1 line-clamp-1">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 hover:bg-emerald-900 hover:text-emerald-200" 
                            onClick={() => handleRestore(project)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 hover:bg-red-900 hover:text-red-200" 
                            onClick={() => confirmPermanentDelete(project)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-gray-900 border border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-200 flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
              Permanently Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete the project "{projectToDelete?.name}". 
              This action cannot be undone and all data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermanentDelete}
              className="bg-red-900 hover:bg-red-800 text-gray-200 border-none"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
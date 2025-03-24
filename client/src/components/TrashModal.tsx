import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Project, getTrashedProjects, restoreProjectFromTrash, permanentlyDeleteProject } from "@/lib/projectService";

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectRestored: () => void; // Callback to refresh project list after restore
}

export default function TrashModal({ isOpen, onClose, onProjectRestored }: TrashModalProps) {
  const [trashedProjects, setTrashedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Load trashed projects when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTrashedProjects();
    }
  }, [isOpen]);

  const loadTrashedProjects = async () => {
    setIsLoading(true);
    try {
      const projects = await getTrashedProjects();
      setTrashedProjects(projects);
    } catch (error) {
      console.error("Error loading trashed projects:", error);
      toast({
        title: "Error",
        description: "Failed to load trashed projects",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (project: Project) => {
    setIsProcessing(true);
    try {
      const success = await restoreProjectFromTrash(project.id);
      if (success) {
        toast({
          title: "Project Restored",
          description: `"${project.name}" has been restored successfully`,
        });
        // Remove from local list
        setTrashedProjects(trashedProjects.filter(p => p.id !== project.id));
        // Notify parent to refresh main project list
        onProjectRestored();
      } else {
        toast({
          title: "Error",
          description: "Failed to restore project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error restoring project:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async (project: Project) => {
    setSelectedProject(project);
    setIsPermanentDeleteDialogOpen(true);
  };

  const confirmPermanentDelete = async () => {
    if (!selectedProject) return;
    
    setIsProcessing(true);
    try {
      const success = await permanentlyDeleteProject(selectedProject.id);
      if (success) {
        toast({
          title: "Project Permanently Deleted",
          description: `"${selectedProject.name}" has been permanently deleted`,
        });
        // Remove from local list
        setTrashedProjects(trashedProjects.filter(p => p.id !== selectedProject.id));
      } else {
        toast({
          title: "Error",
          description: "Failed to delete project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error permanently deleting project:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsPermanentDeleteDialogOpen(false);
      setSelectedProject(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Trash2 className="mr-2 h-5 w-5 text-red-500" />
              <span>Trash</span>
            </DialogTitle>
            <DialogDescription>
              View, restore, or permanently delete trashed projects.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : trashedProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Trash is empty</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Trashed</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trashedProjects.map(project => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{project.name}</span>
                        {project.description && (
                          <span className="text-xs text-gray-400 truncate max-w-[250px]">
                            {project.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <span className="text-sm text-gray-400">
                                {project.deleted_at && 
                                  formatDistanceToNow(new Date(project.deleted_at), { addSuffix: true })}
                              </span>
                              <Info className="h-3.5 w-3.5 ml-1 text-gray-400" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {project.deleted_at && 
                              format(new Date(project.deleted_at), 'PPpp')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleRestore(project)}
                          disabled={isProcessing}
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" />
                          <span>Restore</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handlePermanentDelete(project)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for permanent deletion */}
      <AlertDialog 
        open={isPermanentDeleteDialogOpen} 
        onOpenChange={setIsPermanentDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center">
              <Trash2 className="mr-2 h-5 w-5" />
              Permanently Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                Are you sure you want to permanently delete 
                <span className="font-semibold"> "{selectedProject?.name}"</span>?
              </p>
              <p className="text-red-500">
                This action is irreversible. All notes and images in this project will be permanently deleted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmPermanentDelete();
              }}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
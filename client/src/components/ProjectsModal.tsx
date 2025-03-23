import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { PlusCircle, LoaderCircle, Trash2, Save, FileDown } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { 
  getProjects, 
  getProject,
  createProject, 
  deleteProject, 
  updateProject,
  Project 
} from '../lib/projectService';
import { useNotes } from '../context/NotesContext';
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

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectsModal({ isOpen, onClose }: ProjectsModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const { toast } = useToast();
  const { 
    notes, 
    importNotes,
    exportNotes 
  } = useNotes();

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    setLoading(true);
    const projectsList = await getProjects();
    setProjects(projectsList);
    setLoading(false);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a project name',
        variant: 'destructive',
      });
      return;
    }

    setSavingNew(true);
    try {
      const notesData = exportNotes();
      const newProject = await createProject(newProjectName, notesData);
      
      if (newProject) {
        toast({
          title: 'Success',
          description: 'Project created successfully',
        });
        setNewProjectName('');
        await fetchProjects();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create project',
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
      setSavingNew(false);
    }
  };

  const handleUpdateProject = async (project: Project) => {
    try {
      const notesData = exportNotes();
      const updated = await updateProject(project.id, project.name, notesData);
      
      if (updated) {
        toast({
          title: 'Success',
          description: 'Project updated successfully',
        });
        await fetchProjects();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update project',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const confirmDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      const success = await deleteProject(projectToDelete.id);
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Project deleted successfully',
        });
        await fetchProjects();
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

  const handleLoadProject = async (project: Project) => {
    try {
      console.log('Loading project from list:', project.name, project.id);
      
      // Get full project with notes from database
      setLoading(true);
      const fullProject = await getProject(project.id);
      setLoading(false);
      
      if (!fullProject) {
        console.error('Failed to fetch full project data');
        toast({
          title: 'Error',
          description: 'Failed to fetch full project data',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Full project data loaded:', fullProject.data);
      console.log('Notes count:', fullProject.data.notes.length);
      
      if (!fullProject.data || !fullProject.data.notes) {
        console.error('Project data is missing or malformed:', fullProject.data);
        toast({
          title: 'Error',
          description: 'Project data is missing or malformed',
          variant: 'destructive',
        });
        return;
      }
      
      // Pass both the data and the project name
      importNotes(fullProject.data, fullProject.name);
      
      toast({
        title: 'Success',
        description: `Project "${fullProject.name}" loaded successfully`,
      });
      onClose();
    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: 'Error',
        description: 'Failed to load project',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-800 pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Your Projects</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-project" className="text-gray-300">Create New Project</Label>
                <Input 
                  id="new-project" 
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="bg-gray-850 border-gray-700"
                />
              </div>
              <Button 
                onClick={handleCreateProject}
                disabled={savingNew || !newProjectName.trim()}
                className="mb-0.5"
              >
                {savingNew ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                Create
              </Button>
            </div>
            
            <div className="border border-gray-800 rounded-md p-4 bg-gray-900">
              <h3 className="font-medium mb-4 text-gray-300">Your Projects</h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No projects found. Create your first project!
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div 
                      key={project.id} 
                      className="p-3 border border-gray-800 rounded-md bg-gray-850 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-gray-200">{project.name}</h4>
                          <p className="text-sm text-gray-400">
                            Updated: {formatDate(project.updated_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 hover:bg-gray-700 hover:text-gray-200"
                            onClick={() => handleLoadProject(project)}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            Load
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 hover:bg-gray-700 hover:text-gray-200"
                            onClick={() => handleUpdateProject(project)}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 hover:bg-red-900 hover:text-red-200" 
                            onClick={() => confirmDeleteProject(project)}
                          >
                            <Trash2 className="h-4 w-4" />
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
            <AlertDialogTitle className="text-gray-200">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete the project "{projectToDelete?.name}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject}
              className="bg-red-900 hover:bg-red-800 text-gray-200 border-none"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
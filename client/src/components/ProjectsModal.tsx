import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { PlusCircle, LoaderCircle, Trash2, Save, FileDown, Edit, Archive } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { 
  getProjects, 
  getProject,
  createProject, 
  moveProjectToTrash, 
  updateProject,
  Project 
} from '../lib/projectService';
import TrashModal from './TrashModal';
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
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showTrashModal, setShowTrashModal] = useState(false);
  const { toast } = useToast();
  const { 
    notes, 
    importNotes,
    exportNotes,
    setCurrentProjectId,
    setHasActiveProject,
    setCurrentProjectName,
    setCurrentProjectDescription
  } = useNotes();

  // Define fetchProjects before using it in useEffect
  const fetchProjects = async () => {
    console.log('ProjectsModal: Starting to fetch projects...');
    setLoading(true);
    const projectsList = await getProjects();
    console.log('ProjectsModal: Received projects list:', projectsList);
    setProjects(projectsList);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  // Listen for project-updated events to refresh the projects list
  useEffect(() => {
    const handleProjectUpdated = () => {
      console.log('ProjectsModal: Received project-updated event, refreshing projects list');
      if (isOpen) {
        fetchProjects();
      }
    };

    window.addEventListener('project-updated', handleProjectUpdated);

    return () => {
      window.removeEventListener('project-updated', handleProjectUpdated);
    };
  }, [isOpen]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a project name',
        variant: 'destructive',
      });
      return;
    }

    // Check for characters that will be rejected by database
    const hasProblematicChars = /[<>{}[\]\\\/]/.test(newProjectName);
    const hasNonAsciiChars = /[^\x00-\x7F]/.test(newProjectName); // Detect non-ASCII characters like ÆØÅæøå
    
    if (hasProblematicChars || hasNonAsciiChars) {
      toast({
        title: 'Warning',
        description: 'Some characters in the project name are not allowed by the database. Non-ASCII characters (like ÆØÅ) and special characters will be removed.',
        duration: 5000,
      });
    }

    console.log('Creating new project with name:', newProjectName);
    setSavingNew(true);
    try {
      const notesData = exportNotes();
      console.log('Exported notes data:', notesData);
      console.log('Notes count for new project:', notesData.notes.length);

      const newProject = await createProject(newProjectName, notesData);
      console.log('Result from createProject:', newProject);

      if (newProject) {
        // Set the current project ID and mark as having an active project
        setCurrentProjectId(newProject.id);
        setHasActiveProject(true);

        console.log('Set current project ID for new project:', newProject.id);

        toast({
          title: 'Success',
          description: 'Project created successfully',
        });
        setNewProjectName('');
        console.log('Refreshing projects list after creation...');
        await fetchProjects();
      } else {
        console.error('createProject returned null');
        toast({
          title: 'Error',
          description: 'Failed to create project',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error in handleCreateProject:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdateProject = async (project: Project, newName?: string, newDescription?: string) => {
    try {
      const notesData = exportNotes();
      const projectName = newName || project.name;
      const projectDescription = newDescription !== undefined ? newDescription : (project.description || '');

      // Check for special characters when updating project name
      if (newName) {
        // Check for characters that will be rejected by database
        const hasProblematicChars = /[<>{}[\]\\\/]/.test(newName);
        const hasNonAsciiChars = /[^\x00-\x7F]/.test(newName); // Detect non-ASCII characters like ÆØÅæøå
        
        if (hasProblematicChars || hasNonAsciiChars) {
          toast({
            title: 'Warning',
            description: 'Some characters in the project name are not allowed by the database. Non-ASCII characters (like ÆØÅ) and special characters will be removed.',
            duration: 5000,
          });
        }
      }

      const updated = await updateProject(project.id, projectName, notesData, projectDescription);

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
      const success = await moveProjectToTrash(projectToDelete.id);

      if (success) {
        toast({
          title: 'Moved to Trash',
          description: 'Project moved to trash successfully',
        });
        await fetchProjects();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to move project to trash',
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
      if (!project.id) {
        toast({
          title: "Invalid Project",
          description: "Could not load project - missing ID",
          variant: "destructive",
        });
        return;
      }
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

      // Pass data, project name, and project ID to importNotes
      importNotes(fullProject.data, fullProject.name, fullProject.id);

      // Mark as having an active project
      setHasActiveProject(true);

      // Set project description if available in the project data
      if (fullProject.description) {
        setCurrentProjectDescription(fullProject.description);
        console.log('Set project description:', fullProject.description);
      } else {
        setCurrentProjectDescription('');
        console.log('No project description found, setting empty description');
      }

      console.log('Set current project ID:', fullProject.id);

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

  const startEditingProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation(); // Prevent loading the project
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || '');
  };

  const cancelEditing = () => {
    setEditingProject(null);
    setEditName('');
    setEditDescription('');
  };

  const saveProjectChanges = async () => {
    if (!editingProject) return;

    await handleUpdateProject(editingProject, editName, editDescription);
    cancelEditing();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-800 pb-4">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Your Projects</DialogTitle>
            <DialogDescription className="text-gray-400">
              Click on a project to load it. Projects are auto-saved as you work. Use Delete to remove unwanted projects.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-project" className="text-gray-300">Create New Project</Label>
                <Input 
                  id="new-project" 
                  placeholder="Project name (ASCII only)"
                  value={newProjectName}
                  onChange={(e) => {
                    // Filter out non-ASCII characters and problematic characters that database restricts
                    const rawInput = e.target.value;
                    const filteredInput = rawInput.replace(/[^\x00-\x7F]|[<>{}[\]\\\/]/g, '');
                    
                    // Show a warning if characters were filtered out
                    if (filteredInput !== rawInput) {
                      toast({
                        title: 'Character Removed',
                        description: 'Some characters are not allowed in project names due to database constraints.',
                        duration: 3000
                      });
                    }
                    
                    setNewProjectName(filteredInput);
                  }}
                  className="bg-gray-850 border-gray-700"
                />
                {(/[<>{}[\]\\\/]/.test(newProjectName) || /[^\x00-\x7F]/.test(newProjectName)) && (
                  <p className="text-xs text-amber-400 mt-1">
                    Note: Some characters in the project name are not allowed by the database. 
                    Non-ASCII characters (like ÆØÅ) and special characters will be removed.
                  </p>
                )}
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
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-medium text-gray-300">Your Projects</h3>
                <div className="flex gap-2">
                  {/* Trash button */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-gray-850 border-gray-700 text-gray-300 hover:bg-gray-700 flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTrashModal(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-gray-400" />
                    <span>Trash</span>
                  </Button>
                </div>
              </div>


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
                      className="p-3 border border-gray-800 rounded-md bg-gray-850 hover:bg-gray-700 transition-colors cursor-pointer flex flex-col relative"
                      onClick={() => handleLoadProject(project)}
                    >
                      {editingProject?.id === project.id ? (
                        // Edit mode
                        <div onClick={(e) => e.stopPropagation()} className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-gray-300">Project Name</Label>
                            <Input 
                              id="edit-name" 
                              value={editName}
                              onChange={(e) => {
                                // Filter out non-ASCII characters and problematic characters that database restricts
                                const rawInput = e.target.value;
                                const filteredInput = rawInput.replace(/[^\x00-\x7F]|[<>{}[\]\\\/]/g, '');
                                
                                // Show a warning if characters were filtered out
                                if (filteredInput !== rawInput) {
                                  toast({
                                    title: 'Character Removed',
                                    description: 'Some characters are not allowed in project names due to database constraints.',
                                    duration: 3000
                                  });
                                }
                                
                                setEditName(filteredInput);
                              }}
                              className="bg-gray-800 border-gray-700"
                              placeholder="Project name (ASCII only)"
                            />
                            {(/[<>{}[\]\\\/]/.test(editName) || /[^\x00-\x7F]/.test(editName)) && (
                              <p className="text-xs text-amber-400 mt-1">
                                Note: Some characters in the project name are not allowed by the database. 
                                Non-ASCII characters (like ÆØÅ) and special characters will be removed.
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-description" className="text-gray-300">Project Description</Label>
                            <textarea 
                              id="edit-description" 
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              className="w-full rounded-md px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 h-20"
                              placeholder="Add a description for your project"
                            />
                          </div>
                          <div className="flex justify-end space-x-2 mt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={cancelEditing}
                              className="border-gray-700"
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={saveProjectChanges}
                              disabled={!editName.trim()}
                            >
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <div className="flex flex-col gap-2">
                            <div>
                              <div className="flex items-center mb-1">
                                <FileDown className="h-5 w-5 mr-3 text-gray-400" />
                                <h4 className="font-medium text-gray-200">
                                  {project.name}
                                  <span className="ml-2 text-xs text-gray-500 border border-gray-700 rounded px-1 py-0.5">Click to load</span>
                                </h4>
                              </div>
                              <div className="text-sm text-gray-400 ml-8 flex items-center gap-4">
                                <span>Updated: {formatDate(project.updated_at)}</span>
                                <span 
                                  className="border border-gray-700 rounded px-2 py-0.5 flex items-center" 
                                  title="Number of notes"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="font-semibold">{project.note_count ?? 0}</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gray-700 hover:bg-blue-900 hover:text-blue-200" 
                                onClick={(e) => startEditingProject(e, project)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gray-700 hover:bg-red-900 hover:text-red-200" 
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent triggering the parent div's onClick
                                  confirmDeleteProject(project);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {project.description && (
                            <div className="mt-2 text-sm text-gray-400 border-t border-gray-800 pt-2">
                              {project.description}
                            </div>
                          )}
                        </>
                      )}
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
              <Trash2 className="mr-2 h-5 w-5 text-gray-400" />
              Move to Trash
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              The project "{projectToDelete?.name}" will be moved to trash. 
              You can restore it later from the Trash if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject}
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 border-none"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trash Modal */}
      <TrashModal 
        isOpen={showTrashModal} 
        onClose={() => setShowTrashModal(false)} 
        onProjectRestored={fetchProjects}
      />
    </>
  );
}
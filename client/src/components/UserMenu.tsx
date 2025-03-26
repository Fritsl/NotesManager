import { useState } from 'react';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { User, LogIn, LogOut, FolderOpen, Save, Edit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import ProjectsModal from './ProjectsModal';
import PayoffModal from './PayoffModal';
import { useToast } from '../hooks/use-toast';
import { useNotes } from '../context/NotesContext';
import { createProject, updateProject } from '../lib/projectService';

export default function UserMenu() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showPayoffModal, setShowPayoffModal] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { exportNotes } = useNotes();

  const getInitials = () => {
    if (!user?.email) return '?';
    return user.email.substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: 'Success',
        description: 'You have been logged out',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive',
      });
    }
  };

  const handleQuickSave = async () => {
    if (!user) {
      toast({
        title: 'Not logged in',
        description: 'Please log in to save your project',
        variant: 'destructive',
      });
      setShowAuthModal(true);
      return;
    }

    try {
      const notesData = exportNotes();
      const projectName = `Quick Save - ${new Date().toLocaleString()}`;
      
      const newProject = await createProject(projectName, notesData);
      
      if (newProject) {
        toast({
          title: 'Success',
          description: 'Project saved successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save project',
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {user ? (
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
          ) : (
            <Button variant="outline" size="sm">
              <User className="h-4 w-4 mr-2" />
              Account
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user ? (
            <>
              <DropdownMenuLabel className="font-bold">
                Who's Signed In
              </DropdownMenuLabel>
              <DropdownMenuLabel className="pt-0">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowProjectsModal(true)}>
                <FolderOpen className="h-4 w-4 mr-2" />
                My Projects
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleQuickSave}>
                <Save className="h-4 w-4 mr-2" />
                Quick Save
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPayoffModal(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile Payoff
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => setShowAuthModal(true)}>
              <LogIn className="h-4 w-4 mr-2" />
              Log In / Register
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      
      <ProjectsModal 
        isOpen={showProjectsModal} 
        onClose={() => setShowProjectsModal(false)} 
      />
      
      <PayoffModal
        isOpen={showPayoffModal}
        onClose={() => setShowPayoffModal(false)}
      />
    </>
  );
}
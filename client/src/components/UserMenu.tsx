import { useState, useEffect } from 'react';
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
import { User, LogIn, LogOut, FolderOpen, Save, Edit, Download, Undo } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import ProjectsModal from './ProjectsModal';
import PayoffModal from './PayoffModal';
import { useToast } from '../hooks/use-toast';
import { useNotes } from '../context/NotesContext';
import { createProject, updateProject } from '../lib/projectService';

// Extend Window interface to include our PWA utility
declare global {
  interface Window {
    pwa?: {
      installPWA: () => void;
    };
  }
}

export default function UserMenu() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showPayoffModal, setShowPayoffModal] = useState(false);
  const [isPwaInstallable, setIsPwaInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { exportNotes, canUndo, undoLastAction, getUndoDescription } = useNotes();
  
  // Check if the app can be installed as a PWA and set up key event listeners
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // The app can be installed as a PWA
      setIsPwaInstallable(true);
    };
    
    // Monitor online/offline status
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
      if (navigator.onLine) {
        toast({
          title: "You're back online",
          description: "Your changes will now sync to the server",
        });
      } else {
        toast({
          title: "You're offline",
          description: "Changes will be saved locally and sync when you reconnect",
          variant: "destructive",
        });
      }
    };
    
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Z or Command+Z (macOS)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undoLastAction();
        toast({
          title: "Action Undone",
          description: getUndoDescription() || "Last action has been undone",
        });
      }
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('keydown', handleKeyDown);
    
    // Set initial offline state
    setIsOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toast, canUndo, undoLastAction, getUndoDescription]);

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
  
  // Handler for installing the PWA
  const handleInstallPwa = () => {
    // Access the deferredPrompt from the window object
    // Note: We're using the window.pwa object defined in pwa-register.js
    const pwa = window.pwa;
    if (typeof window !== 'undefined' && pwa && pwa.installPWA) {
      pwa.installPWA();
      toast({
        title: 'Installing App',
        description: 'Notes Editor is being installed on your device',
      });
      // After install is triggered, reset the state
      setIsPwaInstallable(false);
    } else {
      toast({
        title: 'Cannot Install',
        description: 'App installation is not available in this browser or it\'s already installed',
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
              {canUndo && (
                <DropdownMenuItem onClick={undoLastAction}>
                  <Undo className="h-4 w-4 mr-2" />
                  {getUndoDescription() || 'Undo Last Action'}
                </DropdownMenuItem>
              )}
              {isPwaInstallable && (
                <DropdownMenuItem onClick={handleInstallPwa}>
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </DropdownMenuItem>
              )}
              {isOffline && (
                <DropdownMenuItem className="text-amber-500">
                  <span className="h-4 w-4 mr-2 rounded-full bg-amber-500"></span>
                  Offline Mode
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setShowAuthModal(true)}>
                <LogIn className="h-4 w-4 mr-2" />
                Log In / Register
              </DropdownMenuItem>
              {isPwaInstallable && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleInstallPwa}>
                    <Download className="h-4 w-4 mr-2" />
                    Install App
                  </DropdownMenuItem>
                </>
              )}
              {isOffline && (
                <DropdownMenuItem className="text-amber-500">
                  <span className="h-4 w-4 mr-2 rounded-full bg-amber-500"></span>
                  Offline Mode
                </DropdownMenuItem>
              )}
            </>
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
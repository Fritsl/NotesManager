import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import NotesEditor from "@/pages/NotesEditor";
import { NotesProvider } from "@/context/NotesContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import AuthModal from "@/components/AuthModal";
import { Toaster } from "@/components/ui/toaster";
import TestInputField from "@/components/TestInputField";

// Authentication guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [, navigate] = useLocation();
  
  // If still loading auth state, show a simple loading indicator
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If user is not authenticated, show login screen
  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-gray-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to Notes</CardTitle>
            <CardDescription>Please sign in to use the application</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-gray-400">
              This hierarchical notes application requires authentication to protect your data 
              and enable sharing features.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={() => setShowAuthModal(true)}
            >
              Sign In / Create Account
            </Button>
          </CardFooter>
        </Card>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }
  
  // User is authenticated, render the children
  return <>{children}</>;
}

// Define the interface for URL parameters
interface UrlParams {
  projectId: string | null;
  noteId: string | null;
}

function Router({ urlParams }: { urlParams: UrlParams }) {
  return (
    <>
      <Switch>
        <Route 
          path="/" 
          component={() => (
            <AuthGuard>
              <NotesProvider urlParams={urlParams}>
                <NotesEditor />
              </NotesProvider>
            </AuthGuard>
          )} 
        />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  // Parse URL parameters for deep linking from FastPresenter
  // URL format: https://fastpresenterdata.netlify.app/?project=[project_uuid]&note=[note_uuid]
  const [urlParams, setUrlParams] = useState<UrlParams>({
    projectId: null,
    noteId: null
  });

  useEffect(() => {
    // Parse query parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const projectId = searchParams.get('project');
    const noteId = searchParams.get('note');
    
    console.log('Deep link parameters detected:', { projectId, noteId });
    
    if (projectId || noteId) {
      setUrlParams({
        projectId,
        noteId
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router urlParams={urlParams} />
        <TestInputField />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

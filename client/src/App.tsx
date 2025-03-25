import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import NotesEditor from "@/pages/NotesEditor";
import ImageTestPage from "@/pages/ImageTestPage";
import { NotesProvider } from "@/context/NotesContext";
import { AuthProvider } from "@/context/AuthContext";

function Router() {
  return (
    <>
      <div className="fixed top-0 right-0 p-4 z-50 flex gap-2">
        <Link href="/">
          <a className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary/80">Notes App</a>
        </Link>
        <Link href="/image-test">
          <a className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary/80">Image Test</a>
        </Link>
      </div>
      
      <Switch>
        <Route 
          path="/" 
          component={() => (
            <NotesProvider>
              <NotesEditor />
            </NotesProvider>
          )} 
        />
        <Route path="/image-test" component={ImageTestPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

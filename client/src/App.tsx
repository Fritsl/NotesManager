import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import NotesEditor from "@/pages/NotesEditor";
import ImageTestPage from "@/pages/ImageTestPage";
import ImageDiagnostics from "@/pages/ImageDiagnostics";
import { NotesProvider } from "@/context/NotesContext";
import { AuthProvider } from "@/context/AuthContext";

function Router() {
  return (
    <>
      <div className="fixed bottom-0 right-0 p-4 z-50 flex gap-2">
        <Link href="/">
          <div className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary/80 cursor-pointer">Notes App</div>
        </Link>
        <Link href="/image-test">
          <div className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary/80 cursor-pointer">Image Test</div>
        </Link>
        <Link href="/image-diagnostics">
          <div className="px-3 py-1 bg-amber-500 text-white rounded-md hover:bg-amber-600 cursor-pointer">Diagnostics</div>
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
        <Route path="/image-diagnostics" component={ImageDiagnostics} />
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

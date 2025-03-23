import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import NotesEditor from "@/pages/NotesEditor";
import TestImage from "@/pages/TestImage";
import { NotesProvider } from "@/context/NotesContext";
import { AuthProvider } from "@/context/AuthContext";

function Router() {
  return (
    <>
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex gap-4">
          <Link href="/">
            <a className="hover:underline">Notes Editor</a>
          </Link>
          <Link href="/test-image">
            <a className="hover:underline">Image Test</a>
          </Link>
        </div>
      </nav>
      <Switch>
        <Route path="/" component={NotesEditor} />
        <Route path="/test-image" component={TestImage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotesProvider>
          <Router />
          <Toaster />
        </NotesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

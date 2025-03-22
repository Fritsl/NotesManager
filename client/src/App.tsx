import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import NotesEditor from "@/pages/NotesEditor";
import { NotesProvider } from "@/context/NotesContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={NotesEditor} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotesProvider>
        <Router />
        <Toaster />
      </NotesProvider>
    </QueryClientProvider>
  );
}

export default App;

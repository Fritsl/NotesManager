import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './context/AuthContext';
import { NotesProvider } from './context/NotesContext';
import NotesEditor from './pages/NotesEditor';
import NotFound from './pages/not-found';

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
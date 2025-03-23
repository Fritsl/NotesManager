import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Redirect, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    // Store the attempted URL to redirect back after login
    sessionStorage.setItem('redirectUrl', location);
    return <Redirect to="/auth" />;
  }

  return <>{children}</>;
}
import { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

type AuthView = 'signIn' | 'signUp' | 'forgotPassword';

export default function AuthPage() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<AuthView>('signIn');
  const [location, setLocation] = useLocation();

  // If the user is already authenticated, redirect to home or saved redirect URL
  useEffect(() => {
    if (user && !loading) {
      const redirectUrl = sessionStorage.getItem('redirectUrl') || '/';
      sessionStorage.removeItem('redirectUrl'); // Clear it after use
      setLocation(redirectUrl);
    }
  }, [user, loading, setLocation]);

  if (loading) return <div>Loading...</div>;
  if (user) return <Redirect to="/" />;

  const handleAuthSuccess = () => {
    // The useEffect will handle the redirect once the user state updates
  };

  const renderForm = () => {
    switch (currentView) {
      case 'signIn':
        return (
          <SignInForm
            onSuccess={handleAuthSuccess}
            onSignUpClick={() => setCurrentView('signUp')}
            onForgotPasswordClick={() => setCurrentView('forgotPassword')}
          />
        );
      case 'signUp':
        return (
          <SignUpForm
            onSuccess={handleAuthSuccess}
            onSignInClick={() => setCurrentView('signIn')}
          />
        );
      case 'forgotPassword':
        return (
          <ForgotPasswordForm
            onSuccess={() => setTimeout(() => setCurrentView('signIn'), 3000)} // Go back to sign in after 3 seconds
            onBackToSignInClick={() => setCurrentView('signIn')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side: Auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {renderForm()}
        </div>
      </div>
      
      {/* Right side: Hero section */}
      <div className="hidden md:flex md:flex-1 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-10">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-foreground">
            Hierarchical Notes Editor
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Organize your thoughts with our powerful hierarchical note-taking tool. Create, edit, and structure your notes with ease.
          </p>
          <ul className="space-y-3 text-left">
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Intuitive drag-and-drop organization</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Real-time collaboration</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Automatic saving of your work</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Support for rich content and linking</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type AuthView = 'signIn' | 'signUp' | 'forgotPassword';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthView;
}

export function AuthModal({ isOpen, onClose, initialView = 'signIn' }: AuthModalProps) {
  const [currentView, setCurrentView] = useState<AuthView>(initialView);

  const handleAuthSuccess = () => {
    onClose();
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
}
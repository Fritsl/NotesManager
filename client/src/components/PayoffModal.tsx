import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/queryClient';

// Profile response type
interface ProfileResponse {
  id?: string;
  user_id?: string;
  payoff?: string;
  created_at?: string;
  updated_at?: string;
  error?: string;
  code?: string;
}

interface PayoffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PayoffModal({ isOpen, onClose }: PayoffModalProps) {
  const [payoff, setPayoff] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      fetchCurrentPayoff();
    }
  }, [isOpen, user]);

  const fetchCurrentPayoff = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get user profile from our API
      const response = await apiRequest<ProfileResponse>(`/api/profile/${user.id}`);
      
      if (response.error) {
        // If the error code is PROFILE_NOT_FOUND it means the profile doesn't exist yet
        if (response.code === 'PROFILE_NOT_FOUND') {
          // This is ok - it just means we need to create the profile
          console.log('No profile found, will create on save');
          setPayoff('');
          toast({
            title: 'Notice',
            description: 'Creating new profile, you can now add your payoff.',
          });
        } else {
          console.error('Error fetching payoff:', response.error);
          toast({
            title: 'Notice',
            description: 'Failed to load profile, please try again.',
          });
        }
      } else {
        // Profile exists, set the payoff
        setPayoff(response.payoff || '');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while loading your profile.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Create or update profile using our API
      const response = await apiRequest<{success?: boolean; error?: string}>('/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          payoff
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.error) {
        console.error('Error saving payoff:', response.error);
        toast({
          title: 'Error',
          description: 'Failed to save payoff',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Payoff saved successfully',
        });
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile Payoff</DialogTitle>
          <DialogDescription>
            Update your profile payoff that appears in your public profile.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="payoff" className="text-right">
              Payoff
            </Label>
            <Input
              id="payoff"
              placeholder="Enter your profile payoff"
              value={payoff}
              onChange={(e) => setPayoff(e.target.value)}
              className="col-span-3"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
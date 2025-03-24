import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
      // Fetch user metadata from Supabase Auth
      const { data: { user: userData }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error fetching user data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load user data, please try again.',
          variant: 'destructive',
        });
        return;
      }
      
      // Get payoff from user metadata
      const userPayoff = userData?.user_metadata?.payoff || '';
      setPayoff(userPayoff);
      
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
      // Update user metadata in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        data: { payoff }
      });
      
      if (error) {
        console.error('Error saving payoff:', error);
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
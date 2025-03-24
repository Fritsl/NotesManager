import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
      // First check if the user profile exists
      const { data, error } = await supabase
        .from('profiles')
        .select('payoff')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        // If the error is "no rows returned" it means the profile doesn't exist yet
        if (error.code === 'PGRST116') {
          // This is ok - it just means we need to create the profile
          console.log('No profile found, will create on save');
          setPayoff('');
        } else {
          console.error('Error fetching payoff:', error);
          toast({
            title: 'Notice',
            description: 'Creating new profile, you can now add your payoff.',
          });
        }
      } else if (data) {
        setPayoff(data.payoff || '');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // First check if the profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      let saveError;
      
      if (checkError && checkError.code === 'PGRST116') {
        // No profile exists, create a new one
        console.log('Creating new profile for user:', user.id);
        const { error } = await supabase
          .from('profiles')
          .insert([{ 
            user_id: user.id,
            payoff 
          }]);
        
        saveError = error;
      } else {
        // Profile exists, update it
        console.log('Updating existing profile for user:', user.id);
        const { error } = await supabase
          .from('profiles')
          .update({ payoff })
          .eq('user_id', user.id);
        
        saveError = error;
      }
      
      if (saveError) {
        console.error('Error saving payoff:', saveError);
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
import { useState, useEffect } from 'react';

// Types for the Wake Lock API
interface WakeLockSentinel extends EventTarget {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: 'release', listener: EventListenerOrEventListenerObject): void;
}

// Define interface for the wake lock hook return values
interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  error: Error | null;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

// Custom hook to manage screen wake lock
export function useWakeLock(): UseWakeLockReturn {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Check if the Wake Lock API is supported
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  // Request a wake lock
  const request = async (): Promise<void> => {
    if (!isSupported) {
      console.warn('Wake Lock API is not supported in this browser');
      return;
    }
    
    try {
      // TypeScript trick to bypass type checking for the navigator.wakeLock API
      const nav = navigator as any;
      const sentinel = await nav.wakeLock.request('screen');
      setWakeLock(sentinel);
      setIsActive(true);
      setError(null);
      
      // Add event listener for when the wake lock is released
      sentinel.addEventListener('release', () => {
        setIsActive(false);
        setWakeLock(null);
      });
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to request wake lock'));
      console.error('Error requesting wake lock:', err);
    }
  };

  // Release the wake lock
  const release = async (): Promise<void> => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setIsActive(false);
        setWakeLock(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to release wake lock'));
        console.error('Error releasing wake lock:', err);
      }
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(err => {
          console.error('Error releasing wake lock during cleanup:', err);
        });
      }
    };
  }, [wakeLock]);

  // Re-request wake lock when visibility changes (e.g., user comes back to the tab)
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLock) {
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, isSupported, wakeLock]);

  return {
    isSupported,
    isActive,
    error,
    request,
    release
  };
}
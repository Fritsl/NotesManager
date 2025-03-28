import React, { useState, useCallback, useContext, createContext, ReactNode } from 'react';

/**
 * ZenModeContext Type Definition
 * Defines the shape of the context data and functions
 */
interface ZenModeContextType {
  isZenMode: boolean;
  toggleZenMode: () => void;
}

// Default context state
const defaultState: ZenModeContextType = {
  isZenMode: false,
  toggleZenMode: () => {}, // No-op function as placeholder
};

// Create the context with default state
export const ZenModeContext = createContext<ZenModeContextType>(defaultState);

/**
 * ZenModeProvider Component
 * Provides global Zen Mode state to all child components
 */
export const ZenModeProvider = ({ children }: { children: ReactNode }) => {
  // State for zen mode toggle
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  
  // Toggle function with useCallback for memoization
  const toggleZenMode = useCallback(() => {
    setIsZenMode(prevState => !prevState);
  }, []);
  
  // Create context value object
  const contextValue: ZenModeContextType = {
    isZenMode,
    toggleZenMode,
  };
  
  return (
    <ZenModeContext.Provider value={contextValue}>
      {children}
    </ZenModeContext.Provider>
  );
};

/**
 * useZenMode Hook
 * Returns the current zen mode state (boolean)
 * Zen Mode shows only note titles and hides most UI elements except edit and move buttons
 */
export function useZenMode(): boolean {
  const { isZenMode } = useContext(ZenModeContext);
  return isZenMode;
}

/**
 * useZenModeToggle Hook
 * Returns both the zen mode state and the toggle function
 */
export function useZenModeToggle(): [boolean, () => void] {
  const { isZenMode, toggleZenMode } = useContext(ZenModeContext);
  return [isZenMode, toggleZenMode];
}
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ZenModeContextType {
  isZenMode: boolean;
  toggleZenMode: () => void;
}

const defaultState: ZenModeContextType = {
  isZenMode: false,
  toggleZenMode: () => {},
};

export const ZenModeContext = createContext<ZenModeContextType>(defaultState);

export const ZenModeProvider = ({ children }: { children: ReactNode }) => {
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  
  const toggleZenMode = useCallback(() => {
    setIsZenMode((prev) => !prev);
  }, []);
  
  return (
    <ZenModeContext.Provider value={{ isZenMode, toggleZenMode }}>
      {children}
    </ZenModeContext.Provider>
  );
};

export function useZenMode(): boolean {
  const { isZenMode } = useContext(ZenModeContext);
  return isZenMode;
}

export function useZenModeToggle(): [boolean, () => void] {
  const { isZenMode, toggleZenMode } = useContext(ZenModeContext);
  return [isZenMode, toggleZenMode];
}
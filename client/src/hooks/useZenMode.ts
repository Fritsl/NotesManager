import { useState, useEffect } from "react";

export function useZenMode() {
  const [isZenMode, setIsZenMode] = useState(false);

  useEffect(() => {
    // Function to handle zen mode changes via custom event
    const handleZenModeChange = (event: CustomEvent<{ isZenMode: boolean }>) => {
      setIsZenMode(event.detail.isZenMode);
    };

    // Add event listener
    window.addEventListener('zen-mode-change', handleZenModeChange as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('zen-mode-change', handleZenModeChange as EventListener);
    };
  }, []);

  return isZenMode;
}
import { useState, useEffect } from "react";

/**
 * Custom hook for responsive design
 * @param query Media query string like '(max-width: 768px)'
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);
    
    // Update matches when media query changes
    const listener = () => {
      setMatches(media.matches);
    };
    
    // Add event listener
    media.addEventListener("change", listener);
    
    // Clean up
    return () => media.removeEventListener("change", listener);
  }, [query]);
  
  return matches;
}

/**
 * Custom hook to detect mobile devices
 * @returns Boolean indicating if the current viewport is mobile-sized
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/**
 * Custom hook to detect tablet devices
 * @returns Boolean indicating if the current viewport is tablet-sized
 */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

/**
 * Custom hook to detect desktop devices
 * @returns Boolean indicating if the current viewport is desktop-sized
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
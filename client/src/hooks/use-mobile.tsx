import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

// Export a named function to ensure proper hot module replacement compatibility
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Initial check
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Set initial value
    checkIfMobile()
    
    // Add event listener
    window.addEventListener("resize", checkIfMobile)
    
    // Cleanup
    return () => {
      window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  return { isMobile }
}

export { useIsMobile }

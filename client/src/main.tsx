import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import screenfull from "screenfull";

// Initialize fullscreen on load
const initFullScreen = () => {
  if (screenfull.isEnabled) {
    // Try to enter fullscreen immediately on component mount
    // This won't work in most browsers without user interaction
    // So we'll also set up event listeners for first interaction as a fallback
    
    // Function to request fullscreen
    const requestFullscreen = () => {
      screenfull.request().catch((err) => {
        console.log("Error attempting to enable full-screen mode:", err);
      });
    };
    
    // Try immediately (may not work in all browsers)
    try {
      // Set a small timeout to let the page load first
      setTimeout(() => {
        requestFullscreen();
      }, 500);
    } catch (err) {
      console.log("Could not auto-enter fullscreen, will try on first interaction");
    }
    
    // Fallback: Enter fullscreen on first interaction
    const enterFullscreenOnFirstInteraction = () => {
      requestFullscreen();
      
      // Remove the event listeners after first interaction
      document.removeEventListener("click", enterFullscreenOnFirstInteraction);
      document.removeEventListener("keydown", enterFullscreenOnFirstInteraction);
    };

    // Add event listeners for first interaction fallback
    document.addEventListener("click", enterFullscreenOnFirstInteraction);
    document.addEventListener("keydown", enterFullscreenOnFirstInteraction);
    
    // Also provide a way to toggle fullscreen with F11
    document.addEventListener("keydown", (e) => {
      if (e.key === "F11") {
        e.preventDefault(); // Prevent default F11 behavior
        if (screenfull.isEnabled) {
          screenfull.toggle();
        }
      }
    });

    // Log when fullscreen changes
    screenfull.on("change", () => {
      console.log(
        screenfull.isFullscreen
          ? "Entered fullscreen mode"
          : "Exited fullscreen mode"
      );
    });
  }
};

// Initialize fullscreen functionality
initFullScreen();

createRoot(document.getElementById("root")!).render(
  <DndProvider backend={HTML5Backend}>
    <App />
  </DndProvider>
);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import screenfull from "screenfull";

// Initialize fullscreen on load
const initFullScreen = () => {
  if (screenfull.isEnabled) {
    // This can only be called as a result of user action (like a click)
    // We'll set a flag to do this on first user interaction
    const enterFullscreenOnFirstInteraction = () => {
      // Try to enter fullscreen
      screenfull.request().catch((err) => {
        console.log("Error attempting to enable full-screen mode:", err);
      });
      
      // Remove the event listeners after first interaction
      document.removeEventListener("click", enterFullscreenOnFirstInteraction);
      document.removeEventListener("keydown", enterFullscreenOnFirstInteraction);
    };

    // Add event listeners for first interaction
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

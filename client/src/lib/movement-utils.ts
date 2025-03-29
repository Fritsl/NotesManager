import { Note } from '@/types/notes';

/**
 * Formats a note's position information for display
 * @param parentId The parent ID or null for root-level notes
 * @param position The position index within the parent
 * @returns A formatted string describing the position
 */
export function formatNotePosition(parentId: string | null, position: number): string {
  return parentId ? `child of ${parentId.substring(0, 6)}... at pos ${position}` : `root at pos ${position}`;
}

/**
 * Creates a descriptive text about a note movement operation
 * @param note The note being moved
 * @param sourceParentId The original parent ID (or null if at root)
 * @param sourcePosition The original position within parent
 * @param targetParentId The destination parent ID (or null if moving to root)
 * @param targetPosition The destination position
 * @returns A formatted string describing the movement
 */
export function createMoveDescription(
  note: Note,
  sourceParentId: string | null,
  sourcePosition: number,
  targetParentId: string | null,
  targetPosition: number
): string {
  // Create a short note content preview (first 15 chars)
  const notePreview = note.content.substring(0, 15) + (note.content.length > 15 ? '...' : '');

  // Determine movement type
  let movementType: string;
  if (sourceParentId === targetParentId) {
    if (targetPosition < sourcePosition) {
      movementType = 'moving up';
    } else if (targetPosition > sourcePosition) {
      movementType = 'moving down';
    } else {
      movementType = 'no change'; // Same position
    }
  } else {
    movementType = sourceParentId === null ? 'moving to child level' : 
                   targetParentId === null ? 'moving to root level' : 
                   'moving to different parent';
  }

  // Create the movement description
  return `Moving note: "${notePreview}" (${movementType})
From: ${formatNotePosition(sourceParentId, sourcePosition)}
To: ${formatNotePosition(targetParentId, targetPosition)}`;
}

/**
 * Shows a movement indicator for a note by ID
 * @param noteId The ID of the note being moved
 * @param moveDescription Text describing the movement
 */
export function showMoveIndicator(noteId: string, moveDescription: string): void {
  // Find the note element in the DOM
  const noteElement = document.getElementById(`note-${noteId}`);
  
  if (!noteElement) return;
  
  // Create or find the movement indicator element
  let indicator = document.getElementById(`movement-indicator-${noteId}`);
  
  if (!indicator) {
    // Create a new indicator if one doesn't exist
    indicator = document.createElement('div');
    indicator.id = `movement-indicator-${noteId}`;
    indicator.className = 'note-movement-indicator';
    
    // Style the indicator
    Object.assign(indicator.style, {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '8px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: '9999',
      pointerEvents: 'none',
      whiteSpace: 'pre-line',
      maxWidth: '300px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      transition: 'opacity 0.5s ease',
      top: '0',
      right: '0',
    });
    
    // Add to body
    document.body.appendChild(indicator);
  }
  
  // Position the indicator near the note
  const noteRect = noteElement.getBoundingClientRect();
  indicator.style.top = `${noteRect.top + window.scrollY}px`;
  indicator.style.left = `${noteRect.right + window.scrollX + 10}px`;
  
  // Set the description text
  indicator.textContent = moveDescription;
  
  // Show the indicator
  indicator.style.opacity = '1';
  
  // Hide after a delay
  setTimeout(() => {
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator && indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 500); // Remove from DOM after fade out
    }
  }, 3000); // Show for 3 seconds
}
import { Note } from "@/types/notes";
import { toast } from "@/hooks/use-toast";

interface SaveOperation {
  note: Note;
  saveToDatabase: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// The singleton save queue
class SaveQueue {
  private queue: SaveOperation[] = [];
  private isSaving: boolean = false;
  private saveProjectFn: ((silent?: boolean) => Promise<any>) | null = null;
  private updateNoteFn: ((note: Note) => void) | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 800; // milliseconds

  // Check if the queue is initialized with required functions
  isInitialized(): boolean {
    return !!this.saveProjectFn && !!this.updateNoteFn;
  }

  // Initialize the queue with required functions
  initialize(saveProjectFn: (silent?: boolean) => Promise<any>, updateNoteFn: (note: Note) => void) {
    this.saveProjectFn = saveProjectFn;
    this.updateNoteFn = updateNoteFn;
    console.log("✅ SaveQueue initialized with required functions");
  }

  // Add a save operation to the queue
  enqueue(operation: SaveOperation): void {
    // Check if we have a similar note already in the queue
    const existingIndex = this.queue.findIndex(op => op.note.id === operation.note.id);
    
    if (existingIndex !== -1) {
      // Replace the existing operation with the newer one
      console.log(`🔄 Replacing queued operation for note ${operation.note.id}`);
      this.queue[existingIndex] = operation;
    } else {
      // Add as a new operation
      console.log(`➕ Adding note ${operation.note.id} to save queue`);
      this.queue.push(operation);
    }

    // Trigger the processing of the queue with debounce
    this.debouncedProcessQueue();
  }

  // Process all operations in the queue
  private processQueue = async (): Promise<void> => {
    if (this.isSaving || this.queue.length === 0 || !this.saveProjectFn || !this.updateNoteFn) {
      return;
    }

    try {
      this.isSaving = true;
      console.log(`🔄 Processing save queue with ${this.queue.length} operation(s)`);

      // First handle all in-memory updates
      this.queue.forEach(operation => {
        console.log(`💾 Updating note ${operation.note.id} in memory`);
        this.updateNoteFn!(operation.note);
      });

      // Determine if any operation requires database save
      const needsDatabaseSave = this.queue.some(op => op.saveToDatabase);

      if (needsDatabaseSave) {
        // Save to database - this will save all notes since we've already updated them in memory
        console.log(`💾 Saving all changes to database`);
        await this.saveProjectFn(this.queue.length === 1); // Only show toast for single operations
        
        // Call success callbacks
        this.queue.forEach(operation => {
          if (operation.saveToDatabase && operation.onSuccess) {
            operation.onSuccess();
          }
        });
      } else {
        console.log(`💾 In-memory updates only, no database save required`);
      }

      // Clear the queue after successful processing
      this.queue = [];
    } catch (error) {
      console.error("❌ Error processing save queue:", error);
      
      // Call error callbacks
      this.queue.forEach(operation => {
        if (operation.saveToDatabase && operation.onError && error instanceof Error) {
          operation.onError(error);
        }
      });

      // Show error toast
      toast({
        title: "Error Saving Changes",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      this.isSaving = false;
    }
  };

  // Create a debounced version of the queue processor using setTimeout
  private debouncedProcessQueue = (): void => {
    // Clear any existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Set a new timer
    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.DEBOUNCE_DELAY);
  };

  // Force an immediate save (bypassing debounce)
  forceSave(): Promise<void> {
    // Cancel any pending debounced operations
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Process the queue immediately
    return this.processQueue();
  }

  // Check if the queue is currently saving
  isProcessing(): boolean {
    return this.isSaving;
  }

  // Check if the queue has pending operations
  hasPendingOperations(): boolean {
    return this.queue.length > 0;
  }

  // Clear the queue without saving
  clear(): void {
    this.queue = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    console.log("🧹 Save queue cleared without saving");
  }
}

// Create and export a singleton instance
export const saveQueue = new SaveQueue();
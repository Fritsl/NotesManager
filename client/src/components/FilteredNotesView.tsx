import React, { useState, useRef, useEffect } from "react";
import { Note } from "@/types/notes";
import { FilterType } from "./FilterMenu";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { 
  Clock, MessageSquare, Image, Link2, Video, 
  Edit, Check, X, Trash2, Upload, Save,
  Youtube, MessageCircle, Link, ImagePlus
} from "lucide-react";

// Helper function to calculate time between notes
const parseTimeSet = (timeStr: string | null): number | null => {
  if (!timeStr) return null;
  
  // Parse time in format "HH:MM:SS" or "HH:MM"
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  
  // Convert to total minutes
  return hours * 60 + minutes + seconds / 60;
}

// Format minutes to MM:SS string
const formatTimeAllocation = (minutes: number): string => {
  if (minutes < 0) return "--:--";
  
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  
  return `${wholeMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Find the next note with time_set in a flattened array
const findNextNoteWithTime = (notes: Note[], currentNoteId: string): Note | null => {
  const flattenedNotes: Note[] = [];
  
  // Function to flatten the tree into an array in the order notes appear
  const flattenTree = (notesArray: Note[], parentId: string | null = null) => {
    notesArray.forEach(note => {
      flattenedNotes.push(note);
      if (note.children && note.children.length > 0) {
        flattenTree(note.children, note.id);
      }
    });
  };
  
  // Flatten the tree
  flattenTree(notes);
  
  // Find current note index
  const currentIndex = flattenedNotes.findIndex(note => note.id === currentNoteId);
  if (currentIndex === -1) return null;
  
  // Find next note with time_set
  for (let i = currentIndex + 1; i < flattenedNotes.length; i++) {
    if (flattenedNotes[i].time_set) {
      return flattenedNotes[i];
    }
  }
  
  return null;
}

// Count notes between two notes in the flattened tree
const countNotesBetween = (notes: Note[], startNoteId: string, endNoteId: string): number => {
  // For adjacent timed notes without any notes in between, we count only the two timed notes
  // This means we return 2 (the start note and the end note)
  
  const flattenedNotes: Note[] = [];
  
  // Function to flatten the tree into an array in the order notes appear
  const flattenTree = (notesArray: Note[]) => {
    notesArray.forEach(note => {
      flattenedNotes.push(note);
      if (note.children && note.children.length > 0) {
        flattenTree(note.children);
      }
    });
  };
  
  // Flatten the tree
  flattenTree(notes);
  
  // Find start and end indices
  const startIndex = flattenedNotes.findIndex(note => note.id === startNoteId);
  const endIndex = flattenedNotes.findIndex(note => note.id === endNoteId);
  
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return 0;
  }
  
  // Check if notes are adjacent in the flattened tree (or have only timed notes between them)
  let intermediateNoteCount = 0;
  for (let i = startIndex + 1; i < endIndex; i++) {
    intermediateNoteCount++;
  }
  
  // If there are no notes between, or just the end note, return 2 (start and end)
  if (intermediateNoteCount === 0) {
    return 2; // Count the start and end notes
  } else {
    // Otherwise return the total count including start and end
    return intermediateNoteCount + 2; 
  }
}

// Calculate time allocation for each note
interface TimeAllocationResult {
  formattedTime: string;
  noteCount: number;
  totalMinutes: number;
}

const calculateTimeAllocation = (currentNote: Note, allNotes: Note[]): TimeAllocationResult | null => {
  if (!currentNote.time_set) return null;
  
  console.log("🕒 Calculating time for note:", currentNote.id, currentNote.content.substring(0, 20));
  
  // Find the next note with time_set
  const nextTimedNote = findNextNoteWithTime(allNotes, currentNote.id);
  console.log("🕒 Next timed note:", nextTimedNote ? 
    `${nextTimedNote.id} - ${nextTimedNote.content.substring(0, 20)}` : "none");
  
  let noteCount = 0;
  let totalMinutes = 0;
  let formattedTime = "";
  
  if (!nextTimedNote || !nextTimedNote.time_set) {
    console.log("🕒 No next timed note found, returning null");
    // If this is the last timed note, don't show any calculation
    // since we can't calculate time to "next" timed note
    return null;
  }
  
  // Parse time values
  const currentTime = parseTimeSet(currentNote.time_set);
  const nextTime = parseTimeSet(nextTimedNote.time_set);
  console.log("🕒 Time values:", currentNote.time_set, nextTimedNote.time_set);
  
  if (currentTime === null || nextTime === null) return null;
  
  // Calculate time difference in minutes, handle wrapping across midnight
  let timeDiff = nextTime - currentTime;
  if (timeDiff <= 0) {
    // If next time is earlier than current time, assume it's the next day
    // Add 24 hours (1440 minutes) to get proper difference
    timeDiff = timeDiff + (24 * 60);
  }
  console.log("🕒 Time difference (minutes):", timeDiff);
  
  // IMPORTANT FIX: First find the direct route between the two timed notes
  // We're going to directly count the exact number of slides between them
  // This will fix issues with counting notes in different branches

  // Flatten the tree to get all nodes in display order
  const flattenedNotes: Note[] = [];
  const flattenTree = (notesArray: Note[]) => {
    notesArray.forEach(note => {
      flattenedNotes.push(note);
      if (note.children && note.children.length > 0) {
        flattenTree(note.children);
      }
    });
  };
  flattenTree(allNotes);
  
  // Find positions of both timed notes in the flattened tree
  const currentIndex = flattenedNotes.findIndex(note => note.id === currentNote.id);
  const nextIndex = flattenedNotes.findIndex(note => note.id === nextTimedNote.id);
  
  if (currentIndex >= 0 && nextIndex >= 0) {
    // Count notes between, but EXCLUDE the next timed note (we only want to count
    // the current timed note and all slides UNTIL the next timed note)
    noteCount = (nextIndex - currentIndex);
    console.log("🕒 Slide positions in tree:", currentIndex, nextIndex);
    console.log("🕒 Total slide count (excluding next timed note):", noteCount);
  } else {
    // Fallback to old method if indexes aren't found
    console.log("🕒 Using fallback counting method");
    noteCount = 1; // Default to just the current timed note
  }
  
  if (noteCount <= 0) {
    console.log("🕒 Note count is invalid, using default");
    formattedTime = "05:00"; // Default 5 minutes if there are no notes between
    totalMinutes = 5;
    return { formattedTime, noteCount: 1, totalMinutes };
  }
  
  // Calculate time per note in minutes
  const timePerNote = timeDiff / noteCount;
  totalMinutes = timeDiff;
  console.log("🕒 Minutes per slide:", timePerNote);
  
  // Format as MM:SS
  formattedTime = formatTimeAllocation(timePerNote);
  
  console.log("🕒 Final calculation:", { formattedTime, noteCount, totalMinutes });
  return { formattedTime, noteCount, totalMinutes };
};
import { levelColors } from "@/lib/level-colors";
import { cn } from "@/lib/utils";

interface FilteredNotesViewProps {
  filteredNotes: Note[];
  filterType: FilterType;
}

export default function FilteredNotesView({ filteredNotes, filterType }: FilteredNotesViewProps) {
  const { notes, selectNote, updateNote, saveProject, uploadImage, removeImage } = useNotes();
  const { toast } = useToast();
  
  // State for keeping track of which note is being edited
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTimeSet, setEditTimeSet] = useState<string | null>(null);
  const [editIsDiscussion, setEditIsDiscussion] = useState(false);
  const [editYoutubeUrl, setEditYoutubeUrl] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [editUrlDisplayText, setEditUrlDisplayText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const contentEditRef = useRef<HTMLTextAreaElement>(null);
  
  // Listen for search result selection events
  useEffect(() => {
    const handleSearchResultSelected = (event: CustomEvent) => {
      const { noteId } = event.detail;
      
      // Check if this note is in our filtered list
      const foundNote = filteredNotes.find(note => note.id === noteId);
      if (!foundNote) return;
      
      // Scroll to the note after a small delay to ensure rendering is complete
      setTimeout(() => {
        const noteElement = document.getElementById(`note-${noteId}`);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add highlight effect
          noteElement.classList.add('highlight-search-result');
          setTimeout(() => {
            noteElement.classList.remove('highlight-search-result');
          }, 2000);
        }
      }, 100);
    };
    
    window.addEventListener('search-result-selected', handleSearchResultSelected as EventListener);
    
    return () => {
      window.removeEventListener('search-result-selected', handleSearchResultSelected as EventListener);
    };
  }, [filteredNotes]);

  if (!filterType || filteredNotes.length === 0) {
    return null;
  }

  const getFilterIcon = (type: FilterType) => {
    switch (type) {
      case "time":
        return <Clock className="h-4 w-4" />;
      case "discussion":
        return <MessageSquare className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      case "link":
        return <Link2 className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getFilterTitle = (type: FilterType): string => {
    switch (type) {
      case "time":
        return "Notes with time set";
      case "video":
        return "Notes with YouTube videos";
      case "image":
        return "Notes with images";
      case "discussion":
        return "Discussion notes";
      case "link":
        return "Notes with links";
      case "color":
        return "Notes by color";
      default:
        return "Filtered notes";
    }
  };

  // Subtitle function removed

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditTimeSet(note.time_set);
    setEditIsDiscussion(note.is_discussion || false);
    setEditYoutubeUrl(note.youtube_url);
    setEditUrl(note.url);
    setEditUrlDisplayText(note.url_display_text);
    selectNote(note);
    
    // Focus the textarea on the next tick
    setTimeout(() => {
      if (contentEditRef.current) {
        contentEditRef.current.focus();
      }
    }, 0);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
  };

  const saveNote = async (note: Note) => {
    setIsSaving(true);
    
    try {
      // Update the note in memory with all properties
      const updatedNote = {
        ...note,
        content: editContent,
        time_set: editTimeSet,
        is_discussion: editIsDiscussion,
        youtube_url: editYoutubeUrl,
        url: editUrl,
        url_display_text: editUrlDisplayText
      };
      
      // First update in local state
      updateNote(updatedNote);
      
      // Then save to server
      await saveProject();
      
      toast({
        title: "Note Updated",
        description: "Changes have been saved",
      });
      
      setEditingNoteId(null);
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: "Save Failed",
        description: "Could not save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleImageUpload = async (noteId: string, file: File) => {
    try {
      setIsSaving(true);
      const note = filteredNotes.find(n => n.id === noteId);
      
      if (!note) return;
      
      const result = await uploadImage(noteId, file);
      if (result) {
        toast({
          title: "Image Uploaded",
          description: "Image has been added to the note",
        });
        
        // Ensure the note has an images array
        const existingImages = note.images || [];
        
        // Create updated note with the new image properly integrated
        const updatedNote = {
          ...note,
          images: [...existingImages, result]
        };
        
        // First update the note in the state
        updateNote(updatedNote);
        
        // Then save the project to ensure images are synced with server
        await saveProject();
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
      toast({
        title: "Upload Failed",
        description: "Could not upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleRemoveImage = async (noteId: string, imageId: string | undefined) => {
    if (!imageId) {
      console.error("Cannot remove image: Image ID is undefined");
      toast({
        title: "Error",
        description: "Cannot remove image: Invalid image ID",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSaving(true);
      const note = filteredNotes.find(n => n.id === noteId);
      
      if (!note) return;
      
      const success = await removeImage(imageId);
      if (success) {
        toast({
          title: "Image Removed",
          description: "Image has been removed from the note",
        });
        
        // First update the note in local state
        const updatedNote = {
          ...note,
          images: (note.images || []).filter(img => img.id !== imageId)
        };
        updateNote(updatedNote);
        
        // Then save the project to ensure changes are synced
        await saveProject();
      }
    } catch (err) {
      console.error("Failed to remove image:", err);
      toast({
        title: "Remove Failed",
        description: "Could not remove image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Function to find a note's level in the hierarchy (depth in the tree)
  const getNoteLevelInHierarchy = (targetNote: Note): number => {
    // Default to level 0 if we can't determine depth
    let level = 0;
    
    // First build a map of all notes by ID for quick lookup
    const noteMap = new Map<string, { note: Note, parent: string | null }>();
    
    // Recursive function to map the entire hierarchy
    const mapNoteHierarchy = (noteList: Note[], parentId: string | null = null, currentLevel = 0) => {
      for (const note of noteList) {
        noteMap.set(note.id, { note, parent: parentId });
        if (note.children && note.children.length > 0) {
          mapNoteHierarchy(note.children, note.id, currentLevel + 1);
        }
      }
    };
    
    // Map the current note hierarchy
    mapNoteHierarchy(notes);
    
    // Now trace the path from our target note to the root to determine the level
    let currentNoteId = targetNote.id;
    let depth = 0;
    let maxIterations = 10; // Safety to prevent infinite loops
    
    while (currentNoteId && maxIterations > 0) {
      const nodeInfo = noteMap.get(currentNoteId);
      if (!nodeInfo) break;
      
      if (nodeInfo.parent === null) {
        // We've reached a root node
        break;
      }
      
      // Move up one level in the hierarchy
      currentNoteId = nodeInfo.parent;
      depth++;
      maxIterations--;
    }
    
    // Ensure the level is within the bounds of our color array
    return Math.min(depth, levelColors.length - 1);
  };
  
  // Display multi-line content with preview
  const getContentPreview = (content: string) => {
    const contentLines = content.split('\n');
    const displayContent = contentLines[0].slice(0, 60) + (contentLines[0].length > 60 ? '...' : '');
    
    // Get multiple lines for preview if available
    const MAX_PREVIEW_LINES = 3;
    const previewLines = contentLines.slice(1, MAX_PREVIEW_LINES + 1).map(line => 
      line.slice(0, 60) + (line.length > 60 ? '...' : '')
    );
    
    // Check if there are more lines beyond what we're showing
    const hasMoreLines = contentLines.length > MAX_PREVIEW_LINES + 1;
    
    return { displayContent, previewLines, hasMoreLines };
  };
  
  // Helper function to format time allocation text
  const formatTimeAllocationText = (note: Note): string => {
    const allocation = calculateTimeAllocation(note, notes);
    if (!allocation) return "";
    
    const { noteCount, totalMinutes, formattedTime } = allocation;
    
    // Format time in hours and minutes
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    
    let timeText = "";
    if (hours > 0) {
      timeText = `${hours} hour${hours !== 1 ? 's' : ''}, `;
    }
    timeText += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    return `${noteCount} slide${noteCount !== 1 ? 's' : ''}, ${timeText} (${formattedTime} per slide)`;
  };

  // Debug logs
  console.log("FilteredNotesView - Available notes:", notes.length);
  console.log("FilteredNotesView - Filtered notes:", filteredNotes.length);
  
  // Log a sample note with time
  const timeNoteExample = filteredNotes.find(note => note.time_set);
  if (timeNoteExample) {
    console.log("Example time note:", timeNoteExample.id, timeNoteExample.time_set);
    const allocation = calculateTimeAllocation(timeNoteExample, notes);
    console.log("Allocation result:", allocation);
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        {getFilterIcon(filterType)}
        <h2 className="text-xl font-bold">{getFilterTitle(filterType)}</h2>
      </div>

      <div className="space-y-3">
        {filteredNotes.map((note) => {
          const { displayContent, previewLines, hasMoreLines } = getContentPreview(note.content);
          const isEditing = editingNoteId === note.id;
          
          // We need to determine the actual depth/level of each note in the tree
          // This will be determined by a helper function that finds the note's position in the hierarchy
          const level = getNoteLevelInHierarchy(note);
          
          return (
            <div 
              id={`note-${note.id}`}
              key={note.id}
              className={cn(
                "note-item border rounded-md p-2 shadow-sm hover:shadow-md relative max-w-full overflow-hidden",
                // Use the level color
                level >= 0 ? levelColors[level].bg : levelColors[0].bg,
                `border-l-[5px] ${level >= 0 ? levelColors[level].border : levelColors[0].border}`
              )}
            >
              {isEditing ? (
                // EDIT MODE
                <div className="w-full" onClick={(e) => e.stopPropagation()}>
                  {/* Content editor with more height */}
                  <Textarea 
                    ref={contentEditRef}
                    rows={2}
                    className="w-full p-2 text-sm bg-gray-850 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary resize-none mb-3"
                    placeholder="Enter note content..."
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                    style={{ height: '3rem', minHeight: '3rem', maxHeight: '3rem', resize: 'none' }}
                  />

                  {/* Properties section (compact, single-line items) */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                    {/* Time settings */}
                    <div className="flex items-center">
                      <label className="text-xs text-gray-400 w-14">Time:</label>
                      <input 
                        type="time" 
                        className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                        value={editTimeSet || ''}
                        onChange={(e) => {
                          // If the value is empty or user clears the field, set to null
                          setEditTimeSet(e.target.value.trim() === '' ? null : e.target.value);
                        }}
                      />
                    </div>
                    
                    {/* Discussion toggle */}
                    <div className="flex items-center">
                      <label className="text-xs text-gray-400 w-20">Discussion:</label>
                      <Switch 
                        checked={editIsDiscussion} 
                        onCheckedChange={setEditIsDiscussion}
                        className="ml-1 data-[state=checked]:bg-blue-600"
                      />
                    </div>
                    
                    {/* YouTube URL */}
                    <div className="flex items-center col-span-2">
                      <label className="text-xs text-gray-400 w-20">YouTube:</label>
                      <input 
                        type="url" 
                        className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                        placeholder="https://youtube.com/watch?v=..."
                        value={editYoutubeUrl || ''}
                        onChange={(e) => setEditYoutubeUrl(e.target.value || null)}
                      />
                    </div>
                    
                    {/* External URL */}
                    <div className="flex items-center col-span-2">
                      <label className="text-xs text-gray-400 w-20">URL:</label>
                      <input 
                        type="url" 
                        className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                        placeholder="https://..."
                        value={editUrl || ''}
                        onChange={(e) => setEditUrl(e.target.value || null)}
                      />
                    </div>
                    
                    {/* Display text (only if URL exists) */}
                    {editUrl && (
                      <div className="flex items-center col-span-2">
                        <label className="text-xs text-gray-400 w-20">Link text:</label>
                        <input 
                          type="text" 
                          className="flex-1 h-7 p-1 rounded text-xs bg-gray-850 border border-gray-700 focus:border-primary"
                          placeholder="Link display text"
                          value={editUrlDisplayText || ''}
                          onChange={(e) => setEditUrlDisplayText(e.target.value || null)}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Images section */}
                  {note.images && note.images.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-400 mb-1">Images:</div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {note.images.map((image) => {
                          // Skip images without an ID to prevent errors
                          if (!image.id) return null;
                          
                          return (
                            <div key={image.id} className="relative group border border-gray-700 rounded overflow-hidden flex-shrink-0" style={{width: '80px', height: '60px'}}>
                              {/* Image with error handling fallback */}
                              <img 
                                src={image.url} 
                                alt="Note attachment" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  // Replace with a fallback UI on error
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null; // Prevent infinite error loops
                                  target.src = ''; // Clear src
                                  target.alt = 'Image unavailable';
                                  target.style.backgroundColor = '#444';
                                  target.style.display = 'flex';
                                  target.style.alignItems = 'center';
                                  target.style.justifyContent = 'center';
                                  target.style.fontSize = '9px';
                                  target.style.padding = '2px';
                                  target.style.textAlign = 'center';
                                }}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button 
                                  variant="destructive" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  onClick={() => handleRemoveImage(note.id, image.id as string)}
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Add images button */}
                  <div className="flex items-center mb-3">
                    <input 
                      type="file" 
                      id={`file-upload-${note.id}`} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(note.id, file);
                          // Clear the input after upload
                          e.target.value = '';
                        }
                      }}
                    />
                    <label htmlFor={`file-upload-${note.id}`} className="cursor-pointer flex items-center text-xs text-gray-400 hover:text-gray-300">
                      <Upload className="h-3 w-3 mr-1" />
                      Add Image
                    </label>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex space-x-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => cancelEditing()}
                    >
                      <X size={14} className="mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => saveNote(note)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <span className="animate-pulse">Saving...</span>
                      ) : (
                        <>
                          <Check size={14} className="mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                // DISPLAY MODE
                <div className="flex" onClick={() => selectNote(note)}>
                  <div className="flex-1">
                    {/* Title line */}
                    <div className="flex items-center">
                      <div 
                        className={`mobile-text-base font-medium ${level >= 0 ? levelColors[level].text : levelColors[0].text} truncate flex-1 max-w-[90%] overflow-hidden`}
                        onDoubleClick={() => startEditing(note)}
                      >
                        {displayContent}
                      </div>
                    </div>
                    
                    {/* Preview lines */}
                    {previewLines.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {previewLines.map((line, index) => (
                          <div 
                            key={index} 
                            className="text-xs text-gray-400 truncate leading-snug max-w-[90%] overflow-hidden"
                            onDoubleClick={() => startEditing(note)}
                          >
                            {line}
                          </div>
                        ))}
                        {hasMoreLines && (
                          <div className="text-xs text-gray-500 italic">more...</div>
                        )}
                      </div>
                    )}
                    
                    {/* Content type indicators with icons */}
                    <div className="flex items-center gap-2 mt-1">
                      {note.is_discussion && (
                        <span className="text-blue-400 shrink-0" title="Discussion">
                          <MessageCircle size={16} />
                        </span>
                      )}
                      {note.youtube_url && (
                        <span className="text-red-400 shrink-0" title="YouTube Video">
                          <Youtube size={16} />
                        </span>
                      )}
                      {note.url && (
                        <span className="text-green-400 shrink-0" title={note.url_display_text || "External Link"}>
                          <Link size={16} />
                        </span>
                      )}
                      {note.images && note.images.length > 0 && (
                        <span className="text-purple-400 shrink-0" title={`${note.images.length} Image${note.images.length > 1 ? 's' : ''}`}>
                          <ImagePlus size={16} />
                        </span>
                      )}
                      {note.time_set && (
                        <span className="text-amber-400 shrink-0 ml-auto" title={`Time: ${note.time_set}`}>
                          <Clock size={16} />
                          {calculateTimeAllocation(note, notes) && (
                            <span className="ml-1 text-xs opacity-90">
                              {formatTimeAllocationText(note)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    
                    {/* Image thumbnails - only show in image filter mode */}
                    {filterType === "image" && note.images && note.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
                        {note.images.map(image => {
                          // Skip images without an ID to prevent errors
                          if (!image.id) return null;
                          
                          return (
                            <div 
                              key={image.id} 
                              className="h-12 w-16 relative rounded overflow-hidden border border-gray-700"
                            >
                              <img 
                                src={image.url} 
                                alt="Attachment" 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = '';
                                  target.alt = 'Image unavailable';
                                  target.style.backgroundColor = '#444';
                                }} 
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Edit button */}
                  <div className="ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-green-500 p-1 touch-target"
                      title="Edit Note"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(note);
                      }}
                    >
                      <Edit size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Youtube, Link, CheckCircle2, FileEdit, ImagePlus, X, ArrowUp, ArrowDown, Trash2, Clock, Expand, Minimize, Edit, ArrowLeft, Check, Maximize2, Plus, MessageSquare, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { NoteImage } from "@/types/notes";
import * as Popover from '@radix-ui/react-popover';
import { useIsMobile } from "@/hooks/useMediaQuery";

export default function NoteEditor() {
  const { 
    selectedNote, 
    updateNote, 
    breadcrumbs, 
    hasActiveProject, 
    saveProject, 
    currentProjectId
  } = useNotes();

  // Get the Notes context to access its methods
  const notesContext = useNotes();
  const { toast } = useToast();
  
  // Always use fullscreen edit mode - it works better on all platforms
  // This simplifies our approach and avoids focus issues
  const [isFullscreenEditMode, setIsFullscreenEditMode] = useState<boolean>(true);

  const [content, setContent] = useState<string>("");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [externalUrl, setExternalUrl] = useState<string>("");
  const [urlDisplayText, setUrlDisplayText] = useState<string>("");
  const [isDiscussion, setIsDiscussion] = useState<boolean>(false);
  const [timeSet, setTimeSet] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Track if the form has unsaved changes
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // References to track the form elements for blur handling
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const youtubeUrlRef = useRef<HTMLInputElement>(null);
  const externalUrlRef = useRef<HTMLInputElement>(null);
  const urlDisplayTextRef = useRef<HTMLInputElement>(null);

  // Auto-save timer references
  const blurSaveTimerRef = useRef<NodeJS.Timeout | null>(null);  // For blur-based auto-save
  const inactivitySaveTimerRef = useRef<NodeJS.Timeout | null>(null);  // For inactivity (5 seconds) auto-save

  // Update form when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.content);
      setYoutubeUrl(selectedNote.youtube_url || "");
      setExternalUrl(selectedNote.url || "");
      setUrlDisplayText(selectedNote.url_display_text || "");
      setIsDiscussion(selectedNote.is_discussion);
      setTimeSet(selectedNote.time_set);
      setHasChanges(false); // Reset changes flag on note selection

      // No longer using mobile-specific fullscreen mode
      // This helps ensure consistent behavior across devices
    } else {
      // Reset form when no note is selected
      setContent("");
      setYoutubeUrl("");
      setExternalUrl("");
      setUrlDisplayText("");
      setIsDiscussion(false);
      setTimeSet(null);
      setHasChanges(false);
    }
  }, [selectedNote]);

  // Direct save function - saves immediately without checks
  const saveDirectly = useCallback(async () => {
    if (!selectedNote || !currentProjectId || !contentRef.current) {
      console.log("Cannot save directly: No note selected, no project ID, or content reference is missing");
      return;
    }

    // Capture the currently focused element
    const activeElement = document.activeElement;
    console.log("🔍 BEFORE saveDirectly - Active element:", (activeElement as HTMLElement)?.id || "none", 
                "Type:", (activeElement as HTMLElement)?.tagName || "unknown");

    try {
      // Get the latest content directly from the DOM reference
      const currentContent = contentRef.current.value;

      // Update local state to keep it in sync
      setContent(currentContent);

      // First update the note in memory ONLY - don't call saveProject() during typing
      const updatedNote = {
        ...selectedNote,
        content: currentContent, // Use the latest content from DOM reference
        youtube_url: youtubeUrl || null,
        url: externalUrl || null,
        url_display_text: externalUrl ? (urlDisplayText || null) : null,
        is_discussion: isDiscussion,
        time_set: timeSet,
      };

      // Update the note in local state first (in-memory only)
      updateNote(updatedNote);
      console.log("✅ Note updated in memory only");

      // CRITICAL CHANGE: Don't save to database during typing - only on blur or explicit save
      // This is the root cause of focus issues - the saveProject() call forces a refresh

      // Reset changes flag after memory update
      // setHasChanges(true); // Keep it flagged as changed
    } catch (error) {
      console.error("❌ Failed to update note in memory:", error);
    }
    
    // Check if focus changed during the update
    const newActiveElement = document.activeElement;
    console.log("🔍 AFTER saveDirectly - Active element:", (newActiveElement as HTMLElement)?.id || "none", 
              "Type:", (newActiveElement as HTMLElement)?.tagName || "unknown");
    console.log("📝 Focus changed?", activeElement !== newActiveElement);
  }, [selectedNote, currentProjectId, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, timeSet, updateNote]);

  // Auto-save when a field loses focus and there are changes
  const handleBlur = useCallback(async (e: React.FocusEvent) => {
    if (selectedNote && hasChanges && contentRef.current) {
      const targetId = (e.target as HTMLElement).id || "unknown";
      console.log(`⚠️ Blur event detected on: ${targetId}, fullscreen mode: ${isFullscreenEditMode}`);
      
      // Verify if we're in the mobile fullscreen editor
      const isMobileEditor = targetId === "noteContentFullscreen" || isFullscreenEditMode;
      
      // Clear any existing blur timer
      if (blurSaveTimerRef.current) {
        clearTimeout(blurSaveTimerRef.current);
      }

      // For mobile editor, we need to be especially careful about focus
      if (isMobileEditor) {
        console.log("📱 Mobile editor blur detected - handling specially");
        
        // Get the current content directly from the DOM reference (most reliable)
        const currentContent = contentRef.current.value;
        
        // Check if there's an actual change to save
        if (currentContent !== selectedNote.content) {
          console.log("📝 Content changed in mobile editor, preparing save");
          
          // Update the in-memory state first to ensure UI consistency
          setContent(currentContent);
          
          // Create the updated note object
          const updatedNote = {
            ...selectedNote,
            content: currentContent,
            youtube_url: youtubeUrl || null,
            url: externalUrl || null,
            url_display_text: externalUrl ? (urlDisplayText || null) : null,
            is_discussion: isDiscussion,
            time_set: timeSet,
          };
          
          // Update note in context (memory only)
          console.log("💾 Updating note in memory:", updatedNote.id);
          updateNote(updatedNote);
          
          // Now save to the database
          try {
            console.log("🔄 Saving mobile note changes to database");
            await saveProject();
            console.log("✅ Mobile note changes saved successfully to database");
            
            // Reset changes after successful save
            setHasChanges(false);
          } catch (error) {
            console.error("❌ Failed to save mobile note to database:", error);
          }
        } else {
          console.log("ℹ️ No actual content changes in mobile editor, skipping save");
        }
      } else {
        // Regular editor blur handling with short delay
        blurSaveTimerRef.current = setTimeout(async () => {
          console.log("Blur auto-save triggered for note:", selectedNote.id);

          // First update the in-memory state
          saveDirectly();

          // Then save to database, but only when focus has LEFT the field
          // This is where we actually persist to the database
          console.log("🔄 Saving note to database after blur");
          
          try {
            await saveProject();
            console.log("✅ Note saved to database after blur");
          } catch (error) {
            console.error("❌ Failed to save note to database after blur:", error);
          }
        }
      }, 800); // Slightly longer delay to ensure we're not in a field transition
    }
  }, [selectedNote, hasChanges, saveDirectly, saveProject]);

  // Auto-save after 5 seconds of inactivity in text fields
  useEffect(() => {
    // Only start inactivity timer if there are unsaved changes
    if (selectedNote && hasChanges && contentRef.current) {
      // Clear any existing inactivity timer
      if (inactivitySaveTimerRef.current) {
        clearTimeout(inactivitySaveTimerRef.current);
      }

      // Set up a new inactivity timer for 5 seconds
      inactivitySaveTimerRef.current = setTimeout(async () => {
        console.log("Inactivity auto-save triggered after 5 seconds");

        // First update in-memory only
        saveDirectly();
        
        // Then save to the database
        try {
          console.log("🔄 Saving to database after inactivity");
          await saveProject();
          console.log("✅ Note saved to database after inactivity");
          setHasChanges(false); // Clear the changes flag after successful save
        } catch (error) {
          console.error("❌ Failed to save to database after inactivity:", error);
        }
      }, 5000); // 5 seconds of inactivity
    }

    // Clean up the timer when component unmounts or note changes
    return () => {
      if (inactivitySaveTimerRef.current) {
        clearTimeout(inactivitySaveTimerRef.current);
      }
    };
  }, [selectedNote, hasChanges, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, timeSet, updateNote, saveProject, saveDirectly]);

  // Set up debounced auto-save for content changes
  const [saveDebounceTimeout, setSaveDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Update the state with new content
    const newContent = e.target.value;
    
    // Track the active element and cursor position before the update
    const activeElement = document.activeElement;
    const selectionStart = (e.target as HTMLTextAreaElement).selectionStart;
    const selectionEnd = (e.target as HTMLTextAreaElement).selectionEnd;
    
    console.log("🔍 Content change - Active element:", (activeElement as HTMLElement)?.id || "none", 
                "Selection:", selectionStart, selectionEnd);
    
    // Update state without triggering a save
    setContent(newContent);
    setHasChanges(true);

    // Clear existing debounce if any
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
    }

    // IMPORTANT: Don't use saveDirectly during rapid typing
    // This prevents focus jumps by avoiding any potential re-renders
    
    // For fullscreen mobile editor, we'll only update in-memory
    // Only set a timer to mark the current state, but don't trigger saves
    const timeout = setTimeout(() => {
      console.log("✏️ Content updated in memory only, no auto-save during typing");
      // We'll save on blur or manual save button only
    }, 300);

    // Save the timeout ID so we can clear it if needed
    setSaveDebounceTimeout(timeout);
  };

  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("YouTube URL change:", e.target.value);
    const newUrl = e.target.value;
    setYoutubeUrl(newUrl);
    setHasChanges(true);

    // Track the active element before setting timeout
    const activeElement = document.activeElement;
    console.log("Active element before timeout:", activeElement?.id);

    // Completely remove the auto-save for YouTube URL - only save on blur
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
    }
    
    // Don't auto-save, only mark as changed
    // We'll save when the field loses focus instead
    console.log("YouTube URL changed but no auto-save scheduled");
  };

  const handleExternalUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("External URL change:", e.target.value);
    const newUrl = e.target.value;
    setExternalUrl(newUrl);
    setHasChanges(true);

    // Track the active element before setting timeout
    const activeElement = document.activeElement;
    console.log("Active element before timeout:", activeElement?.id);

    // Completely remove the auto-save for URL fields - only save on blur
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
    }
    
    // Don't auto-save, only mark as changed
    // We'll save when the field loses focus instead
    console.log("External URL changed but no auto-save scheduled");
  };

  const handleUrlDisplayTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("URL display text change:", e.target.value);
    const newText = e.target.value;
    setUrlDisplayText(newText);
    setHasChanges(true);

    // Track the active element before setting timeout
    const activeElement = document.activeElement;
    console.log("Active element before timeout:", activeElement?.id);

    // Completely remove the auto-save for URL fields - only save on blur
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
    }
    
    // Don't auto-save, only mark as changed
    // We'll save when the field loses focus instead
    console.log("URL display text changed but no auto-save scheduled");
  };

  const handleDiscussionChange = (checked: boolean | "indeterminate") => {
    console.log("Discussion checkbox changed:", checked);
    // Store current content in a variable to preserve it
    const currentContent = contentRef.current?.value || content;

    const newValue = checked === true;

    // Update state
    setIsDiscussion(newValue);
    setHasChanges(true);

    // Clear any auto-save timeout
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
    }
    
    // No need to auto-save on checkbox changes
    // Just update the in-memory state and preserve content
    if (contentRef.current && contentRef.current.value !== currentContent) {
      contentRef.current.value = currentContent;
      setContent(currentContent);
    }
    
    // Only update in-memory to keep focus
    console.log("Discussion status updated in memory, saving on next blur");
    saveDirectly();
  };

  const handleTimeChange = (value: string | null) => {
    console.log("Time picker change:", value);
    // Store time as HH:MM with no seconds
    let formattedTime = null;
    if (value) {
      // Extract just the HH:MM part if there's more
      const timeParts = value.split(':');
      if (timeParts.length >= 2) {
        // Only use hours and minutes, no seconds
        formattedTime = `${timeParts[0]}:${timeParts[1]}`;
      } else {
        formattedTime = value;
      }
    }

    // Update state with the formatted time
    setTimeSet(formattedTime);
    setHasChanges(true);

    // Track the active element before setting timeout
    const activeElement = document.activeElement;
    console.log("Active element before time change:", activeElement?.id);

    // Clear any auto-save timeout
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
    }
    
    // Only update in-memory - this prevents focus jumps in the time picker
    console.log("Time updated in memory only, saving on next blur");
    saveDirectly();
  };

  // Handler for Apply button in the time picker
  const handleApplyTime = () => {
    saveDirectly();
  };

  // Toggle fullscreen edit mode
  const toggleFullscreenMode = () => {
    setIsFullscreenEditMode(prev => !prev);
    console.log("Fullscreen mode toggled:", !isFullscreenEditMode);
  };

  // Listen for fullscreen toggle events from header
  useEffect(() => {
    const handleFullscreenToggle = () => {
      // Toggle fullscreen mode when the event is received
      setIsFullscreenEditMode(prev => !prev);
      console.log("Fullscreen toggle event received, toggling fullscreen mode");
    };

    // Listen for the custom fullscreen toggle event
    window.addEventListener('toggle-fullscreen', handleFullscreenToggle);

    // Cleanup
    return () => {
      window.removeEventListener('toggle-fullscreen', handleFullscreenToggle);
    };
  }, [isFullscreenEditMode]);

  const handleSave = async () => {
    if (!selectedNote || !contentRef.current) return;

    setSaveStatus("saving");

    try {
      // Get the latest content directly from the DOM reference
      const currentContent = contentRef.current.value;

      // Update local state to keep it in sync
      setContent(currentContent);

      // First update the note in memory
      const updatedNote = {
        ...selectedNote,
        content: currentContent, // Use the latest content from DOM reference
        youtube_url: youtubeUrl || null,
        url: externalUrl || null,
        url_display_text: externalUrl ? (urlDisplayText || null) : null,
        is_discussion: isDiscussion,
        time_set: timeSet,
      };

      // Update the note in local state first
      updateNote(updatedNote);

      // Force a direct save to the online database
      console.log("Saving note directly to database");
      await saveProject();
      console.log("Note saved to online database successfully");

      setSaveStatus("saved");

      // Reset status after a delay
      setTimeout(() => {
        setSaveStatus("idle");
      }, 1500);

      // Reset changes flag after successful save
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save note and project:", error);
      setSaveStatus("idle");
    }
  };

  if (!hasActiveProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileEdit className="h-12 w-12 mx-auto mb-3 text-gray-500" />
          <p className="text-gray-500">No active project</p>
        </div>
      </div>
    );
  }

  if (!selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileEdit className="h-12 w-12 mx-auto mb-3 text-gray-500" />
          <p className="text-gray-500">Select a note to edit</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isFullscreenEditMode ? (
        /* MOBILE FULLSCREEN EDIT MODE */
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
          {/* Mobile header */}
          <div className="bg-gray-900 p-2 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleFullscreenMode}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </Button>
              <span className="text-sm font-medium truncate max-w-[15ch]">
                {selectedNote.content.split('\n')[0].slice(0, 15)}
                {selectedNote.content.length > 15 ? '...' : ''}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {isDiscussion && (
                <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                  Discussion
                </span>
              )}

              {youtubeUrl && (
                <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">
                  YouTube
                </span>
              )}

              {externalUrl && (
                <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">
                  Link
                </span>
              )}

              {timeSet && (
                <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">
                  {timeSet}
                </span>
              )}

              {/* Save button */}
              {hasChanges && (
                <Button
                  onClick={handleSave}
                  size="sm"
                  className={`${saveStatus === "saved" ? "bg-green-500 hover:bg-green-600" : ""}`}
                  disabled={saveStatus === "saving"}
                >
                  {saveStatus === "saving" ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </div>

          {/* Full-height textarea */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Textarea 
              id="noteContentFullscreen" 
              ref={contentRef}
              className="flex-1 w-full p-4 text-base bg-gray-950 border-none focus:border-none focus:ring-0 resize-none"
              placeholder="Type your note here..."
              value={content}
              onChange={handleContentChange}
              onBlur={handleBlur}
              style={{ minHeight: '100%', height: '100%' }}
            />
          </div>
        </div>
      ) : (
        /* STANDARD EDIT MODE */
        <div className="flex flex-col h-full overflow-hidden">
          {/* Regular Editor Header */}
          <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 p-2 mb-2 sm:mb-3">
            <div className="flex items-center space-x-2 min-w-0">
              {breadcrumbs.length > 0 ? (
                <div className="flex items-center space-x-1 max-w-[300px] overflow-hidden">
                  {breadcrumbs.map((crumb, i) => (
                    <div key={`breadcrumb-${crumb.id}`} className="flex items-center">
                      {i > 0 && <ArrowLeft size={12} className="text-gray-500 mx-1" />}
                      <span className="text-xs text-gray-400 truncate max-w-[120px]">
                        {crumb.content}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-400">Root Level</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {isDiscussion && (
                <div className="hidden sm:flex items-center space-x-1 px-2 py-0.5 bg-blue-900/20 text-blue-400 rounded text-xs">
                  <MessageSquare size={12} />
                  <span>Discussion</span>
                </div>
              )}

              {youtubeUrl && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center space-x-1 px-2 py-0.5 bg-red-900/20 text-red-400 rounded text-xs"
                >
                  <Youtube size={12} />
                  <span>YouTube</span>
                </a>
              )}

              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center space-x-1 px-2 py-0.5 bg-green-900/20 text-green-400 rounded text-xs"
                >
                  <Link size={12} />
                  <span>{urlDisplayText || "Link"}</span>
                </a>
              )}

              {timeSet && (
                <div className="hidden sm:flex items-center space-x-1 px-2 py-0.5 bg-purple-900/20 text-purple-400 rounded text-xs">
                  <Clock size={12} />
                  <span>{timeSet}</span>
                </div>
              )}

              {/* Save status/button */}
              {hasChanges && (
                <Button
                  onClick={handleSave}
                  size="sm"
                  variant="outline"
                  className={`border-gray-700 ${saveStatus === "saved" ? "bg-green-900/20 text-green-400 border-green-900" : ""}`}
                >
                  {saveStatus === "saving" ? (
                    <span className="flex items-center">Saving...</span>
                  ) : saveStatus === "saved" ? (
                    <span className="flex items-center">
                      <CheckCircle2 size={14} className="mr-1" />
                      Saved
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Save size={14} className="mr-1" />
                      Save
                    </span>
                  )}
                </Button>
              )}

              {/* Fullscreen toggle button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleFullscreenMode} 
                className="text-gray-400 hover:text-white"
              >
                <Maximize2 size={16} />
              </Button>
            </div>
          </div>

          {/* Main Edit Area */}
          <div className="flex-1 overflow-y-auto pb-4">
            <div className="p-2 sm:p-3">
              {/* Main textarea for content */}
              <div className="mb-3">
                <Textarea
                  id="noteContent"
                  ref={contentRef}
                  className="min-h-[200px] text-base p-3 bg-gray-850 border-gray-700"
                  placeholder="Type your note here..."
                  value={content} 
                  onChange={handleContentChange}
                  onBlur={handleBlur}
                />
              </div>

              {/* Optional fields in tabs */}
              <div className="border-t border-gray-800 pt-2 mt-2">
                <div className="grid grid-cols-1 gap-2">
                  {/* YouTube URL - more compact */}
                  <div className="flex items-center space-x-2">
                    <div className="flex-shrink-0">
                      <Youtube size={14} className="text-gray-400" />
                    </div>
                    <Input
                      type="url"
                      id="youtubeUrl"
                      ref={youtubeUrlRef}
                      className="h-8 text-xs bg-gray-850 border-gray-700"
                      placeholder="YouTube URL (optional)"
                      value={youtubeUrl}
                      onChange={handleYoutubeUrlChange}
                      onBlur={handleBlur}
                    />
                  </div>

                  {/* External URL - more compact */}
                  <div className="flex items-center space-x-2">
                    <div className="flex-shrink-0">
                      <Link size={14} className="text-gray-400" />
                    </div>
                    <Input
                      type="url"
                      id="externalUrl"
                      ref={externalUrlRef}
                      className="h-8 text-xs bg-gray-850 border-gray-700"
                      placeholder="Link URL (optional)"
                      value={externalUrl}
                      onChange={handleExternalUrlChange}
                      onBlur={handleBlur}
                    />
                  </div>

                  {/* URL Display Text - only show if URL is entered */}
                  {externalUrl && (
                    <div className="flex items-center space-x-2 ml-5">
                      <Input
                        type="text"
                        id="urlDisplayText"
                        ref={urlDisplayTextRef}
                        className="h-8 text-xs bg-gray-850 border-gray-700"
                        placeholder="Link text (optional)"
                        value={urlDisplayText}
                        onChange={handleUrlDisplayTextChange}
                        onBlur={handleBlur}
                      />
                    </div>
                  )}

                  {/* Time Picker - simple standard input */}
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0">
                        <Clock size={14} className="text-gray-400" />
                      </div>
                      <Label className="text-xs text-gray-400">
                        Set time (optional)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <Button 
                            variant="outline"
                            className="h-9 px-4 flex items-center justify-between bg-gray-850 border-gray-700 hover:bg-gray-800 hover:border-gray-600 w-32"
                          >
                            <span className="text-sm">
                              {timeSet ? (timeSet.includes(':') ? timeSet.split(':').slice(0, 2).join(':') : timeSet) : "Set time"}
                            </span>
                            <Clock size={14} className="ml-2 text-gray-400" />
                          </Button>
                        </Popover.Trigger>
                        <Popover.Content 
                          className="bg-gray-850 border border-gray-700 p-4 rounded-md shadow-lg z-50"
                          sideOffset={5}
                        >
                          <div className="flex flex-col space-y-4">
                            <Input 
                              type="time"
                              value={timeSet ? (timeSet.includes(':') ? timeSet.split(':').slice(0, 2).join(':') : timeSet) : ""}
                              onChange={(e) => handleTimeChange(e.target.value)}
                              className="text-lg px-3 py-2 h-10 bg-gray-800 border-gray-600 focus:border-primary"
                            />
                            <div className="flex justify-between">
                              <Button
                                variant="outline"
                                className="border-gray-700 hover:bg-gray-800"
                                onClick={() => handleTimeChange(null)}
                              >
                                Clear
                              </Button>
                              <Popover.Close asChild>
                                <Button onClick={handleApplyTime}>Apply</Button>
                              </Popover.Close>
                            </div>
                          </div>
                        </Popover.Content>
                      </Popover.Root>
                    </div>
                  </div>

                  {/* Discussion Flag - more compact */}
                  <div className="flex items-center space-x-2 mt-1">
                    <Checkbox
                      id="isDiscussion"
                      className="h-3 w-3 border-gray-600"
                      checked={isDiscussion}
                      onCheckedChange={handleDiscussionChange}
                      onBlur={handleBlur}
                    />
                    <Label htmlFor="isDiscussion" className="text-xs text-gray-400">
                      Mark as discussion
                    </Label>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div className="mt-3 border-t border-gray-800 pt-2">
                <div className="text-xs text-gray-400 flex justify-between items-center mb-2">
                  <span>Images</span>
                  <label 
                    htmlFor="image-upload" 
                    className="inline-flex items-center text-primary hover:text-primary-hover cursor-pointer text-xs"
                  >
                    <ImagePlus size={14} className="mr-1" />
                    <span>Add Image</span>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0 || !selectedNote) return;

                        const file = files[0];
                        if (!file.type.startsWith('image/')) {
                          console.log("Invalid file type:", file.type);
                          return;
                        }

                        // Check file size (limit to 5MB)
                        if (file.size > 5 * 1024 * 1024) {
                          console.log("File too large:", file.size);
                          return;
                        }

                        try {
                          // Upload the image using context
                          const image = await notesContext.uploadImage?.(selectedNote.id, file);

                          if (image) {
                            // Reset the file input
                            e.target.value = '';
                          }
                        } catch (error) {
                          console.error('Error uploading image:', error);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Display images if any */}
                {selectedNote.images && selectedNote.images.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {/* Deduplicate images by converting to a Map using ID as key, then back to array */}
                    {Array.from(
                      // Create a Map with image ID as key to eliminate duplicates
                      new Map(
                        selectedNote.images.map(img => [img.id, img])
                      ).values()
                    )
                    // Sort by position after deduplication
                    .sort((a, b) => a.position - b.position)
                    .map((image) => (
                      <div 
                        key={`image-${image.id}`} 
                        className="relative group border border-gray-800 rounded-md overflow-hidden"
                      >
                        <img 
                          src={image.url} 
                          alt="Note attachment" 
                          className="w-full h-auto object-cover cursor-pointer"
                          onClick={() => window.open(image.url, '_blank')}
                        />
                        <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                          {/* Move up button */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 bg-gray-900/80 hover:bg-gray-800 rounded-full"
                            onClick={async () => {
                              if (image.position > 0 && notesContext.reorderImage && selectedNote.id && image.id) {
                                await notesContext.reorderImage(selectedNote.id, image.id, image.position - 1);
                              }
                            }}
                            disabled={image.position === 0}
                          >
                            <ArrowUp size={14} />
                          </Button>

                          {/* Move down button */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 bg-gray-900/80 hover:bg-gray-800 rounded-full"
                            onClick={async () => {
                              const maxPosition = (selectedNote.images?.length || 1) - 1;
                              if (image.position < maxPosition && notesContext.reorderImage && selectedNote.id && image.id) {
                                await notesContext.reorderImage(selectedNote.id, image.id, image.position + 1);
                              }
                            }}
                            disabled={image.position === (selectedNote.images?.length || 1) - 1}
                          >
                            <ArrowDown size={14} />
                          </Button>

                          {/* Delete button */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 bg-gray-900/80 hover:bg-red-900/80 text-gray-400 hover:text-red-300 rounded-full"
                            onClick={async () => {
                              if (confirm('Are you sure you want to remove this image?') && notesContext.removeImage && image.id) {
                                await notesContext.removeImage(image.id);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Links Section */}
              {(youtubeUrl || externalUrl) && (
                <div className="mt-3 border-t border-gray-800 pt-2">
                  <div className="text-xs text-gray-400 flex justify-between items-center mb-1">
                    <span>Links</span>
                    <div className="flex space-x-2">
                      {youtubeUrl && (
                        <a 
                          href={youtubeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-red-400 hover:text-red-300 text-xs"
                        >
                          <Youtube size={12} className="mr-1" />
                          <span>YouTube</span>
                        </a>
                      )}

                      {externalUrl && (
                        <a 
                          href={externalUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-400 hover:text-blue-300 text-xs"
                        >
                          <Link size={12} className="mr-1" />
                          <span>{urlDisplayText || "Link"}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
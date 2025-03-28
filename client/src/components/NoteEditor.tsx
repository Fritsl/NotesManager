import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Textarea, Button, Input, Label, Checkbox, 
  Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Save, MessageSquare, CheckCircle2, 
  Link as LinkIcon, Youtube, Clock 
} from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { Note } from '../types';
import { cn } from '@/lib/utils';

export default function NoteEditor() {
  // Get the Notes context to access its methods
  const notesContext = useNotes();
  const { toast } = useToast();
  
  // Use a single editing mode that's consistent across all devices
  // No more separate mobile popup editor
  
  // Standard editor state
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

  // Get current project data and selected note
  const {
    currentProjectId,
    selectedNote,
    updateNote,
    saveProject,
    hasActiveProject,
    getBreadcrumbs,
  } = notesContext;

  // Get breadcrumbs for the current note
  const breadcrumbs = selectedNote ? getBreadcrumbs(selectedNote.id) : [];

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
  const handleBlur = useCallback(async (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (selectedNote && hasChanges && contentRef.current) {
      const targetId = (e.target as HTMLElement).id || "unknown";
      console.log(`⚠️ Blur event detected on: ${targetId}`);
      
      // Clear any existing blur timer
      if (blurSaveTimerRef.current) {
        clearTimeout(blurSaveTimerRef.current);
      }

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
      }, 800); // Slightly longer delay to ensure we're not in a field transition
    }
  }, [selectedNote, hasChanges, saveDirectly, saveProject, contentRef, setContent, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, timeSet, updateNote, blurSaveTimerRef, setHasChanges]);

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

  // No more fullscreen toggle functionality - using a single consistent editing interface

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
          <div className="h-12 w-12 mx-auto mb-3 text-gray-500">📄</div>
          <p className="text-gray-500">No active project</p>
        </div>
      </div>
    );
  }

  if (!selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto mb-3 text-gray-500">📝</div>
          <p className="text-gray-500">Select a note to edit</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* UNIFIED EDIT MODE - works the same on all devices */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Editor Header */}
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
                <LinkIcon size={12} />
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
                    <LinkIcon size={14} className="text-gray-400" />
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

                {/* Bottom Row with Checkboxes and Time */}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-800">
                  {/* Discussion Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isDiscussion"
                      className="h-4 w-4 border-gray-600"
                      checked={isDiscussion}
                      onCheckedChange={handleDiscussionChange}
                    />
                    <Label htmlFor="isDiscussion" className="text-xs text-gray-400">
                      Discussion note
                    </Label>
                  </div>

                  {/* Time Picker */}
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="timePicker" className="text-xs text-gray-400">
                      Time:
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[100px] h-7 justify-start text-left text-xs font-normal border-gray-700 bg-gray-850",
                            !timeSet && "text-muted-foreground"
                          )}
                        >
                          {timeSet ? (
                            <span>{timeSet}</span>
                          ) : (
                            <span>Set time...</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 bg-gray-900 border-gray-700">
                        <div className="flex flex-col items-center space-y-2">
                          <Input
                            type="time"
                            id="timePicker"
                            className="h-8 text-xs bg-gray-850 border-gray-700"
                            value={timeSet ? (timeSet.includes(':') ? timeSet.split(':').slice(0, 2).join(':') : timeSet) : ""}
                            onChange={(e) => handleTimeChange(e.target.value)}
                          />
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-gray-700 bg-gray-850 hover:bg-gray-800"
                              onClick={() => handleTimeChange(null)}
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={handleApplyTime}
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
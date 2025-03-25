import { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Youtube, Link, CheckCircle2, FileEdit, ImagePlus, X, ArrowUp, ArrowDown, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { NoteImage } from "@/types/notes";
import * as Popover from '@radix-ui/react-popover';

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
    if (!selectedNote || !currentProjectId) {
      console.log("Cannot save directly: No note selected or no project ID");
      return;
    }
    
    try {
      // First update the note in memory
      const updatedNote = {
        ...selectedNote,
        content,
        youtube_url: youtubeUrl || null,
        url: externalUrl || null,
        url_display_text: externalUrl ? (urlDisplayText || null) : null,
        is_discussion: isDiscussion,
        time_set: timeSet,
      };
      
      // Update the note in local state first
      updateNote(updatedNote);
      
      // Now perform the same actions as the manual save
      console.log("Direct save starting for note:", selectedNote.id);
      console.log("Direct save - Project ID:", currentProjectId);
      
      // Ensure current note is saved to database by calling manual save function
      console.log("Manual save for project ID:", currentProjectId);
      await saveProject();
      console.log("Project saved directly from editor");
      
      // Show a toast notification for the save
      toast({
        title: "Changes Saved",
        description: "Your changes have been saved to the database",
        variant: "default",
      });
      
      // Reset changes flag after successful save
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save project directly:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your changes. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedNote, currentProjectId, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, timeSet, updateNote, saveProject, toast]);
  
  // Auto-save when a field loses focus and there are changes
  const handleBlur = useCallback(async (e: React.FocusEvent) => {
    if (selectedNote && hasChanges) {
      // Clear any existing blur timer
      if (blurSaveTimerRef.current) {
        clearTimeout(blurSaveTimerRef.current);
      }
      
      // Set a short delay to prevent saving while moving between fields
      blurSaveTimerRef.current = setTimeout(async () => {
        try {
          // First update the note in memory
          const updatedNote = {
            ...selectedNote,
            content,
            youtube_url: youtubeUrl || null,
            url: externalUrl || null,
            url_display_text: externalUrl ? (urlDisplayText || null) : null,
            is_discussion: isDiscussion,
            time_set: timeSet,
          };
          
          // Update the note in local state first
          updateNote(updatedNote);
          
          console.log("Blur auto-save triggered for note:", selectedNote.id);
          
          // Force a direct save to the online database
          await saveProject();
          console.log("Blur auto-save completed successfully and saved to online database");
          
          // Reset changes flag after successful save
          setHasChanges(false);
        } catch (error) {
          console.error("Failed during blur auto-save:", error);
          toast({
            title: "Auto-save Failed",
            description: "Changes were not saved automatically. Please use manual save.",
            variant: "destructive",
          });
        }
      }, 500);
    }
  }, [selectedNote, hasChanges, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, timeSet, updateNote, saveProject, toast]);
  
  // Auto-save after 5 seconds of inactivity in text fields
  useEffect(() => {
    // Only start inactivity timer if there are unsaved changes
    if (selectedNote && hasChanges) {
      // Clear any existing inactivity timer
      if (inactivitySaveTimerRef.current) {
        clearTimeout(inactivitySaveTimerRef.current);
      }
      
      // Set up a new inactivity timer for 5 seconds
      inactivitySaveTimerRef.current = setTimeout(async () => {
        try {
          console.log("Inactivity auto-save triggered after 5 seconds");
          
          // First update the note in memory
          const updatedNote = {
            ...selectedNote,
            content,
            youtube_url: youtubeUrl || null,
            url: externalUrl || null,
            url_display_text: externalUrl ? (urlDisplayText || null) : null,
            is_discussion: isDiscussion,
            time_set: timeSet,
          };
          
          // Update the note in local state first
          updateNote(updatedNote);
          
          // Force a direct save to the online database
          await saveProject();
          console.log("Inactivity auto-save completed successfully and saved to online database");
          
          // Reset changes flag after successful save
          setHasChanges(false);
        } catch (error) {
          console.error("Failed during inactivity auto-save:", error);
          // No toast here to avoid disturbing the user during typing
        }
      }, 5000); // 5 seconds of inactivity
    }
    
    // Clean up the timer when component unmounts or note changes
    return () => {
      if (inactivitySaveTimerRef.current) {
        clearTimeout(inactivitySaveTimerRef.current);
      }
    };
  }, [selectedNote, hasChanges, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, timeSet, updateNote, saveProject]);
  
  // Set up change tracking with proper state updates
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasChanges(true);
  };
  
  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setYoutubeUrl(newUrl);
    setHasChanges(true);
  };
  
  const handleExternalUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setExternalUrl(newUrl);
    setHasChanges(true);
  };
  
  const handleUrlDisplayTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setUrlDisplayText(newText);
    setHasChanges(true);
  };
  
  const handleDiscussionChange = (checked: boolean | "indeterminate") => {
    const newValue = checked === true;
    setIsDiscussion(newValue);
    setHasChanges(true);
  };
  
  const handleTimeChange = (value: string | null) => {
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
    
    // Immediate save if needed
    if (selectedNote) {
      // Update the note with the new time
      const updatedNote = {
        ...selectedNote,
        time_set: formattedTime
      };
      updateNote(updatedNote);
    }
  };
  
  // Handler for Apply button in the time picker
  const handleApplyTime = () => {
    saveDirectly();
  };

  const handleSave = async () => {
    if (!selectedNote) return;

    setSaveStatus("saving");
    
    try {
      // First update the note in memory
      const updatedNote = {
        ...selectedNote,
        content,
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
      
      // Show a confirmation toast
      toast({
        title: "Changes Saved",
        description: "Your changes have been saved to the online database",
        variant: "default",
      });
      
      // Reset changes flag after successful save
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save note and project:", error);
      toast({
        title: "Save Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
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
      {/* Toolbar with breadcrumbs */}
      <div className="bg-gray-900 border-b border-gray-800 p-2 flex items-center justify-between shadow-sm">
        <div className="breadcrumbs text-sm text-gray-400 flex items-center overflow-x-auto whitespace-nowrap">
          <span className="px-2 py-1 cursor-pointer hover:bg-gray-800 rounded">Root</span>
          
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center">
              <span className="mx-1 text-gray-500">/</span>
              <span className="px-2 py-1 cursor-pointer hover:bg-gray-800 rounded">
                {crumb.content.split('\n')[0].slice(0, 20)}
                {crumb.content.length > 20 ? '...' : ''}
              </span>
            </div>
          ))}
          
          {breadcrumbs.length > 0 && (
            <div className="flex items-center">
              <span className="mx-1 text-gray-500">/</span>
              <span className="px-2 py-1 font-medium text-primary bg-gray-800 rounded">
                {selectedNote.content.split('\n')[0].slice(0, 20)}
                {selectedNote.content.length > 20 ? '...' : ''}
              </span>
            </div>
          )}
          
          {breadcrumbs.length === 0 && (
            <div className="flex items-center">
              <span className="mx-1 text-gray-500">/</span>
              <span className="px-2 py-1 font-medium text-primary bg-gray-800 rounded">
                {selectedNote.content.split('\n')[0].slice(0, 20)}
                {selectedNote.content.length > 20 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
        
        {/* Only show save button when there are unsaved changes */}
        {hasChanges && (
          <Button
            onClick={handleSave}
            className={`
              flex items-center space-x-1
              ${saveStatus === "saved" ? "bg-green-500 hover:bg-green-600" : ""}
            `}
            disabled={saveStatus === "saving"}
          >
            <Save size={16} />
            <span>{saveStatus === "saving" ? "Saving..." : "Save"}</span>
          </Button>
        )}
      </div>

      {/* Compact note editor form */}
      <div className="p-3 flex-1 overflow-auto bg-gray-950">
        <div className="bg-gray-900 rounded-lg shadow-md border border-gray-800 p-3 mx-auto note-editor-form">
          {/* Content area - more compact now */}
          <div className="mb-3">
            <Label htmlFor="noteContent" className="block text-xs font-medium text-gray-400 mb-1">
              Edit Content
            </Label>
            <Textarea 
              id="noteContent" 
              ref={contentRef}
              rows={6} 
              className="w-full p-2 text-sm bg-gray-850 border-gray-700 focus:border-primary"
              placeholder="Enter note content..."
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
                      toast({
                        title: "Invalid File",
                        description: "Please select an image file",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Check file size (limit to 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                      toast({
                        title: "File Too Large",
                        description: "Image file must be less than 5MB",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    try {
                      // Upload the image using context
                      const image = await notesContext.uploadImage?.(selectedNote.id, file);
                      
                      if (image) {
                        toast({
                          title: "Image Uploaded",
                          description: "Image has been added to the note",
                        });
                        
                        // Reset the file input
                        e.target.value = '';
                      }
                    } catch (error) {
                      console.error('Error uploading image:', error);
                      toast({
                        title: "Upload Failed",
                        description: "There was a problem uploading the image",
                        variant: "destructive",
                      });
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
                          if (image.position > 0) {
                            await notesContext.reorderImage?.(selectedNote.id, image.id, image.position - 1);
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
                          if (image.position < maxPosition) {
                            await notesContext.reorderImage?.(selectedNote.id, image.id, image.position + 1);
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
                          if (confirm('Are you sure you want to remove this image?')) {
                            await notesContext.removeImage?.(image.id);
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
    </>
  );
}

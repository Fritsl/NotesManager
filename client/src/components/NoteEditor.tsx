import { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Youtube, Link, CheckCircle2, FileEdit, ImagePlus, X, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { NoteImage } from "@/types/notes";

export default function NoteEditor() {
  const { 
    selectedNote, 
    updateNote, 
    breadcrumbs, 
    hasActiveProject, 
    saveProject, 
    currentProjectId,
    uploadImage,
    removeImage,
    reorderImage
  } = useNotes();
  const { toast } = useToast();
  
  const [content, setContent] = useState<string>("");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [externalUrl, setExternalUrl] = useState<string>("");
  const [urlDisplayText, setUrlDisplayText] = useState<string>("");
  const [isDiscussion, setIsDiscussion] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  
  // Track if the form has unsaved changes
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  
  // References to track the form elements for blur handling
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const youtubeUrlRef = useRef<HTMLInputElement>(null);
  const externalUrlRef = useRef<HTMLInputElement>(null);
  const urlDisplayTextRef = useRef<HTMLInputElement>(null);
  
  // Auto-save timer reference
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update form when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.content);
      setYoutubeUrl(selectedNote.youtube_url || "");
      setExternalUrl(selectedNote.url || "");
      setUrlDisplayText(selectedNote.url_display_text || "");
      setIsDiscussion(selectedNote.is_discussion);
      setHasChanges(false); // Reset changes flag on note selection
    } else {
      // Reset form when no note is selected
      setContent("");
      setYoutubeUrl("");
      setExternalUrl("");
      setUrlDisplayText("");
      setIsDiscussion(false);
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
  }, [selectedNote, currentProjectId, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, updateNote, saveProject, toast]);
  
  // Auto-save when any field loses focus if there are changes (similar to Google Docs)
  const handleBlur = useCallback(async (e: React.FocusEvent) => {
    // Save the note whenever a field loses focus, even if moving to another field in the form
    if (selectedNote && hasChanges) {
      // Use a small delay to prevent saving while user is still interacting with the form
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          // Use our direct save function to ensure project is saved properly
          await saveDirectly();
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
  }, [selectedNote, hasChanges, saveDirectly, toast]);
  
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

  const handleSave = async () => {
    if (!selectedNote) return;

    setSaveStatus("saving");
    
    try {
      // Use our direct save function to ensure consistent behavior
      await saveDirectly();
      
      setSaveStatus("saved");
      
      // Reset status after a delay
      setTimeout(() => {
        setSaveStatus("idle");
      }, 1500);
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
                      // Upload the image
                      const image = await uploadImage(selectedNote.id, file);
                      
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
                            await reorderImage(selectedNote.id, image.id, image.position - 1);
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
                            await reorderImage(selectedNote.id, image.id, image.position + 1);
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
                            await removeImage(image.id);
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

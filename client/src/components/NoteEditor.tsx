import { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Youtube, Link, CheckCircle2, FileEdit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export default function NoteEditor() {
  const { selectedNote, updateNote, breadcrumbs, hasActiveProject, saveProject, currentProjectId } = useNotes();
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
  
  // Auto-save when form loses focus if there are changes
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if we're still in the editor component (to another input in the same form)
    // This prevents saves when just moving between fields in the same form
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isStillInEditor = relatedTarget && 
      (relatedTarget.closest('.note-editor-form') !== null);
    
    if (isStillInEditor) {
      return; // Don't auto-save when just moving between fields in the same form
    }
    
    if (selectedNote && hasChanges) {
      // Use a small delay to prevent saving while user is still interacting with the form
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(async () => {
        const updatedNote = {
          ...selectedNote,
          content,
          youtube_url: youtubeUrl || null,
          url: externalUrl || null,
          url_display_text: externalUrl ? (urlDisplayText || null) : null,
          is_discussion: isDiscussion,
        };
        
        // Create a clone of the note to avoid focus issues
        updateNote(updatedNote);
        setHasChanges(false);
        
        // Save the entire project if we have a project ID
        if (currentProjectId) {
          try {
            await saveProject();
            console.log("Project auto-saved after note update");
          } catch (error) {
            console.error("Failed to auto-save project:", error);
          }
        }
        
        // Show a subtle toast notification for auto-save
        toast({
          title: "Auto-saved",
          description: "Your changes have been automatically saved",
          variant: "default",
        });
      }, 500);
    }
  }, [selectedNote, hasChanges, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, updateNote, toast, saveProject, currentProjectId]);
  
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
      const updatedNote = {
        ...selectedNote,
        content,
        youtube_url: youtubeUrl || null,
        url: externalUrl || null,
        url_display_text: externalUrl ? (urlDisplayText || null) : null,
        is_discussion: isDiscussion,
      };
      
      // Update the note in local state
      updateNote(updatedNote);
      
      // Save the entire project if we have a project ID
      if (currentProjectId) {
        await saveProject();
        console.log("Project saved manually after note update");
      }
      
      setSaveStatus("saved");
      setHasChanges(false); // Reset changes flag after saving
      
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

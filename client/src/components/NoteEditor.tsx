import { useState, useEffect, useRef, useCallback } from "react";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Youtube, Link, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export default function NoteEditor() {
  const { selectedNote, updateNote, breadcrumbs } = useNotes();
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
  const handleBlur = useCallback(() => {
    if (selectedNote && hasChanges) {
      // Use a small delay to prevent saving while user is still interacting with the form
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(() => {
        const updatedNote = {
          ...selectedNote,
          content,
          youtube_url: youtubeUrl || null,
          url: externalUrl || null,
          url_display_text: externalUrl ? (urlDisplayText || null) : null,
          is_discussion: isDiscussion,
        };
        
        updateNote(updatedNote);
        setHasChanges(false);
        
        // Show a subtle toast notification for auto-save
        toast({
          title: "Auto-saved",
          description: "Your changes have been automatically saved",
          variant: "default",
        });
      }, 500);
    }
  }, [selectedNote, hasChanges, content, youtubeUrl, externalUrl, urlDisplayText, isDiscussion, updateNote, toast]);
  
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

  const handleSave = () => {
    if (!selectedNote) return;

    setSaveStatus("saving");
    
    const updatedNote = {
      ...selectedNote,
      content,
      youtube_url: youtubeUrl || null,
      url: externalUrl || null,
      url_display_text: externalUrl ? (urlDisplayText || null) : null,
      is_discussion: isDiscussion,
    };
    
    updateNote(updatedNote);
    setSaveStatus("saved");
    setHasChanges(false); // Reset changes flag after saving
    
    // Reset status after a delay
    setTimeout(() => {
      setSaveStatus("idle");
    }, 1500);
  };

  if (!selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        {/* Empty editor state - no message shown */}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar with breadcrumbs */}
      <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shadow-sm">
        <div className="breadcrumbs text-sm text-gray-500 flex items-center overflow-x-auto whitespace-nowrap">
          <span className="px-2 py-1 cursor-pointer hover:bg-gray-100 rounded">Root</span>
          
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center">
              <span className="mx-1 text-gray-400">/</span>
              <span className="px-2 py-1 cursor-pointer hover:bg-gray-100 rounded">
                {crumb.content.split('\n')[0].slice(0, 20)}
                {crumb.content.length > 20 ? '...' : ''}
              </span>
            </div>
          ))}
          
          {breadcrumbs.length > 0 && (
            <div className="flex items-center">
              <span className="mx-1 text-gray-400">/</span>
              <span className="px-2 py-1 font-medium text-primary bg-blue-50 rounded">
                {selectedNote.content.split('\n')[0].slice(0, 20)}
                {selectedNote.content.length > 20 ? '...' : ''}
              </span>
            </div>
          )}
          
          {breadcrumbs.length === 0 && (
            <div className="flex items-center">
              <span className="mx-1 text-gray-400">/</span>
              <span className="px-2 py-1 font-medium text-primary bg-blue-50 rounded">
                {selectedNote.content.split('\n')[0].slice(0, 20)}
                {selectedNote.content.length > 20 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
        
        <Button
          onClick={handleSave}
          className={`
            flex items-center space-x-1
            ${saveStatus === "saved" ? "bg-green-500 hover:bg-green-600" : ""}
          `}
          disabled={saveStatus === "saving"}
        >
          <Save size={16} />
          <span>{saveStatus === "saved" ? "Saved" : "Save"}</span>
        </Button>
      </div>

      {/* Compact note editor form */}
      <div className="p-3 flex-1 overflow-auto">
        <div className="bg-white rounded-lg shadow-sm p-3 mx-auto">
          {/* Content area - more compact now */}
          <div className="mb-3">
            <Label htmlFor="noteContent" className="block text-xs font-medium text-gray-500 mb-1">
              Edit Content
            </Label>
            <Textarea 
              id="noteContent" 
              ref={contentRef}
              rows={6} 
              className="w-full p-2 text-sm"
              placeholder="Enter note content..."
              value={content}
              onChange={handleContentChange}
              onBlur={handleBlur}
            />
          </div>
          
          {/* Optional fields in tabs */}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="grid grid-cols-1 gap-2">
              {/* YouTube URL - more compact */}
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <Youtube size={14} className="text-gray-500" />
                </div>
                <Input
                  type="url"
                  id="youtubeUrl"
                  ref={youtubeUrlRef}
                  className="h-8 text-xs"
                  placeholder="YouTube URL (optional)"
                  value={youtubeUrl}
                  onChange={handleYoutubeUrlChange}
                  onBlur={handleBlur}
                />
              </div>
              
              {/* External URL - more compact */}
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <Link size={14} className="text-gray-500" />
                </div>
                <Input
                  type="url"
                  id="externalUrl"
                  ref={externalUrlRef}
                  className="h-8 text-xs"
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
                    className="h-8 text-xs"
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
                  className="h-3 w-3"
                  checked={isDiscussion}
                  onCheckedChange={handleDiscussionChange}
                  onBlur={handleBlur}
                />
                <Label htmlFor="isDiscussion" className="text-xs text-gray-600">
                  Mark as discussion
                </Label>
              </div>
            </div>
          </div>

          {/* Links Section */}
          {(youtubeUrl || externalUrl) && (
            <div className="mt-3 border-t border-gray-100 pt-2">
              <div className="text-xs text-gray-500 flex justify-between items-center mb-1">
                <span>Links</span>
                <div className="flex space-x-2">
                  {youtubeUrl && (
                    <a 
                      href={youtubeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-red-600 hover:text-red-700 text-xs"
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
                      className="inline-flex items-center text-blue-600 hover:text-blue-700 text-xs"
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

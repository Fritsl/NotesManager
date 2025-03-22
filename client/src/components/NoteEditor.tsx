import { useState, useEffect } from "react";
import { useNotes } from "@/context/NotesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Youtube, Link } from "lucide-react";
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

  // Update form when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.content);
      setYoutubeUrl(selectedNote.youtube_url || "");
      setExternalUrl(selectedNote.url || "");
      setUrlDisplayText(selectedNote.url_display_text || "");
      setIsDiscussion(selectedNote.is_discussion);
    } else {
      // Reset form when no note is selected
      setContent("");
      setYoutubeUrl("");
      setExternalUrl("");
      setUrlDisplayText("");
      setIsDiscussion(false);
    }
  }, [selectedNote]);

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
              rows={6} 
              className="w-full p-2 text-sm"
              placeholder="Enter note content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
                  className="h-8 text-xs"
                  placeholder="YouTube URL (optional)"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
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
                  className="h-8 text-xs"
                  placeholder="Link URL (optional)"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
              
              {/* URL Display Text - only show if URL is entered */}
              {externalUrl && (
                <div className="flex items-center space-x-2 ml-5">
                  <Input
                    type="text"
                    id="urlDisplayText"
                    className="h-8 text-xs"
                    placeholder="Link text (optional)"
                    value={urlDisplayText}
                    onChange={(e) => setUrlDisplayText(e.target.value)}
                  />
                </div>
              )}
              
              {/* Discussion Flag - more compact */}
              <div className="flex items-center space-x-2 mt-1">
                <Checkbox
                  id="isDiscussion"
                  className="h-3 w-3"
                  checked={isDiscussion}
                  onCheckedChange={(checked) => setIsDiscussion(checked === true)}
                />
                <Label htmlFor="isDiscussion" className="text-xs text-gray-600">
                  Mark as discussion
                </Label>
              </div>
            </div>
          </div>

          {/* Preview Section - smaller and more compact */}
          <div className="mt-3 border-t border-gray-100 pt-2">
            <div className="text-xs text-gray-500 flex justify-between items-center mb-1">
              <span>Preview</span>
              {(youtubeUrl || externalUrl) && (
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
              )}
            </div>
            <div className="bg-gray-50 rounded p-2 prose prose-sm max-w-none text-xs">
              {content ? (
                content.split('\n').map((paragraph, index) => (
                  <p key={index} className="my-1 text-gray-700">{paragraph}</p>
                ))
              ) : (
                <p className="text-gray-400 italic">No content yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

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
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium text-gray-700 mb-2">No note selected</h3>
              <p className="text-gray-500">
                Select a note from the sidebar or create a new one to edit its content.
              </p>
            </div>
          </CardContent>
        </Card>
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

      {/* Note editor form */}
      <div className="p-6 flex-1 overflow-auto">
        <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
          <div className="mb-4">
            <Label htmlFor="noteContent" className="block text-sm font-medium text-gray-700 mb-1">
              Note Content
            </Label>
            <Textarea 
              id="noteContent" 
              rows={8} 
              className="w-full p-3"
              placeholder="Enter note content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* YouTube URL */}
            <div>
              <Label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 mb-1">
                YouTube URL (optional)
              </Label>
              <div className="flex">
                <div className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                  <Youtube size={16} />
                </div>
                <Input
                  type="url"
                  id="youtubeUrl"
                  className="rounded-l-none"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
              </div>
            </div>
            
            {/* External URL */}
            <div>
              <Label htmlFor="externalUrl" className="block text-sm font-medium text-gray-700 mb-1">
                External URL (optional)
              </Label>
              <div className="flex">
                <div className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                  <Link size={16} />
                </div>
                <Input
                  type="url"
                  id="externalUrl"
                  className="rounded-l-none"
                  placeholder="https://example.com"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </div>
            </div>
            
            {/* URL Display Text */}
            <div>
              <Label htmlFor="urlDisplayText" className="block text-sm font-medium text-gray-700 mb-1">
                URL Display Text
              </Label>
              <Input
                type="text"
                id="urlDisplayText"
                placeholder="Display text for URL"
                value={urlDisplayText}
                onChange={(e) => setUrlDisplayText(e.target.value)}
                disabled={!externalUrl}
              />
            </div>
            
            {/* Discussion Flag */}
            <div className="flex items-center h-full">
              <div className="flex items-center space-x-2 mt-4">
                <Checkbox
                  id="isDiscussion"
                  checked={isDiscussion}
                  onCheckedChange={(checked) => setIsDiscussion(checked === true)}
                />
                <Label htmlFor="isDiscussion" className="text-gray-700">
                  Mark as discussion
                </Label>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
            <div className="bg-gray-50 rounded-md p-4 prose prose-sm max-w-none">
              {content.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              
              {youtubeUrl && (
                <div className="mt-2">
                  <a 
                    href={youtubeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-red-600 hover:text-red-700"
                  >
                    <Youtube size={16} className="mr-1" />
                    <span>Watch on YouTube</span>
                  </a>
                </div>
              )}
              
              {externalUrl && (
                <div className="mt-2">
                  <a 
                    href={externalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-700"
                  >
                    <Link size={16} className="mr-1" />
                    <span>{urlDisplayText || externalUrl}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

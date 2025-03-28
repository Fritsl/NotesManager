import React, { useRef, useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Image, Video, Link2, MessageSquare, Clock } from "lucide-react";
import { Note } from "@/types/notes";
import { useNotes } from "@/context/NotesContext";

interface EditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
}

export default function EditNoteModal({ isOpen, onClose, note }: EditNoteModalProps) {
  const { toast } = useToast();
  const { updateNote, saveProject, uploadImage } = useNotes();
  
  // Edit state
  const [editContent, setEditContent] = useState("");
  const [editTimeSet, setEditTimeSet] = useState<string | null>(null);
  const [editIsDiscussion, setEditIsDiscussion] = useState(false);
  const [editYoutubeUrl, setEditYoutubeUrl] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [editUrlDisplayText, setEditUrlDisplayText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const contentEditRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update state when note changes
  useEffect(() => {
    if (note) {
      setEditContent(note.content);
      setEditTimeSet(note.time_set);
      setEditIsDiscussion(note.is_discussion || false);
      setEditYoutubeUrl(note.youtube_url);
      setEditUrl(note.url);
      setEditUrlDisplayText(note.url_display_text);
    }
  }, [note]);
  
  // Focus the textarea when opening the modal
  useEffect(() => {
    if (isOpen && contentEditRef.current) {
      setTimeout(() => {
        contentEditRef.current?.focus();
        
        // Place cursor at the end of the text
        if (contentEditRef.current) {
          const length = contentEditRef.current.value.length;
          contentEditRef.current.setSelectionRange(length, length);
        }
      }, 100);
    }
  }, [isOpen]);
  
  const handleSaveNote = async () => {
    if (!note) return;
    
    setIsSaving(true);
    
    try {
      // Get content from state
      const currentContent = editContent;
      
      // Update the note in memory with all properties
      const updatedNote = {
        ...note,
        content: currentContent,
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
      
      onClose();
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
  
  const handleImageUpload = async (file: File) => {
    if (!note) return;
    
    try {
      setIsSaving(true);
      
      const result = await uploadImage(note.id, file);
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
        description: "Could not upload the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!note) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Main content textarea */}
          <div className="grid gap-2">
            <label htmlFor="content" className="text-sm font-medium">
              Content
            </label>
            <Textarea
              id="content"
              ref={contentEditRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[100px] p-2 text-sm bg-gray-850 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              placeholder="Enter note content..."
              rows={5}
            />
          </div>
          
          {/* Note properties in a responsive grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Time settings */}
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              <label className="text-xs text-gray-400 w-14">Time:</label>
              <input 
                type="time" 
                className="w-24 text-xs bg-gray-850 border border-gray-700 p-1 rounded-md"
                value={editTimeSet || ""}
                onChange={(e) => setEditTimeSet(e.target.value || null)}
              />
            </div>
            
            {/* Is discussion toggle */}
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-gray-400" />
              <label className="text-xs text-gray-400">Discussion:</label>
              <Switch 
                checked={editIsDiscussion} 
                onCheckedChange={setEditIsDiscussion}
              />
            </div>
            
            {/* YouTube URL */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-gray-400" />
                <label className="text-xs text-gray-400">YouTube URL:</label>
              </div>
              <input 
                type="text" 
                className="w-full text-xs bg-gray-850 border border-gray-700 p-2 rounded-md"
                placeholder="https://youtube.com/watch?v=..."
                value={editYoutubeUrl || ""}
                onChange={(e) => setEditYoutubeUrl(e.target.value || null)}
              />
            </div>
            
            {/* External URL and display text */}
            <div className="sm:col-span-2 grid gap-2">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-gray-400" />
                <label className="text-xs text-gray-400">External URL:</label>
              </div>
              <input 
                type="text" 
                className="w-full text-xs bg-gray-850 border border-gray-700 p-2 rounded-md"
                placeholder="https://example.com"
                value={editUrl || ""}
                onChange={(e) => setEditUrl(e.target.value || null)}
              />
              <input 
                type="text" 
                className="w-full text-xs bg-gray-850 border border-gray-700 p-2 rounded-md"
                placeholder="Display text for URL (optional)"
                value={editUrlDisplayText || ""}
                onChange={(e) => setEditUrlDisplayText(e.target.value || null)}
              />
            </div>
          </div>
          
          {/* Image upload section */}
          <div className="border border-gray-700 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Image size={16} className="text-gray-400" />
                <span className="text-sm font-medium">Images</span>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                Add Image
              </Button>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                    // Clear the input value so the same file can be selected again
                    e.target.value = '';
                  }
                }}
              />
            </div>
            
            {/* Image gallery */}
            {note.images && note.images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {note.images.map((image) => (
                  <div key={image.id} className="relative group">
                    <img 
                      src={image.url} 
                      alt="Note image" 
                      className="w-full h-24 object-cover rounded-md border border-gray-700"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {(!note.images || note.images.length === 0) && (
              <div className="text-sm text-gray-400 text-center py-4">
                No images attached to this note
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            <X size={14} className="mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleSaveNote}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
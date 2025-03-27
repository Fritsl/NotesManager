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
  Youtube, MessageCircle, Link
} from "lucide-react";
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
      default:
        return "Filtered notes";
    }
  };

  const getFilterSubtitle = (count: number): string => {
    return `Found ${count} note${count === 1 ? "" : "s"}`;
  };

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
  
  const handleRemoveImage = async (noteId: string, imageId: string) => {
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

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        {getFilterIcon(filterType)}
        <h2 className="text-xl font-bold">{getFilterTitle(filterType)}</h2>
        <Badge variant="outline">{getFilterSubtitle(filteredNotes.length)}</Badge>
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
                "note-item border rounded-md p-2 shadow-sm hover:shadow-md relative",
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
                    rows={Math.min(6, note.content.split('\n').length + 1)}
                    className="w-full p-2 text-sm bg-gray-850 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary resize-none mb-3"
                    placeholder="Enter note content..."
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
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
                        onChange={(e) => setEditTimeSet(e.target.value ? e.target.value : null)}
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
                        {note.images.map((image) => (
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
                                onClick={() => handleRemoveImage(note.id, image.id)}
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>
                        ))}
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
                        className={`mobile-text-base font-medium ${level >= 0 ? levelColors[level].text : levelColors[0].text} truncate flex-1`}
                        onDoubleClick={() => startEditing(note)}
                      >
                        {displayContent}
                      </div>
                      {note.is_discussion && (
                        <span className="ml-2 text-blue-400 shrink-0" title="Discussion">
                          <MessageCircle size={16} />
                        </span>
                      )}
                    </div>
                    
                    {/* Preview lines */}
                    {previewLines.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {previewLines.map((line, index) => (
                          <div 
                            key={index} 
                            className="text-xs text-gray-400 truncate leading-snug"
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
                    
                    {/* Badges for special attributes */}
                    {(note.youtube_url || note.url || note.time_set) && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {note.youtube_url && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-950 text-white border border-red-700 shadow-sm">
                            <Youtube size={12} className="mr-1" />
                            YouTube
                          </span>
                        )}
                        
                        {note.url && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-950 text-white border border-blue-700 shadow-sm">
                            <Link size={12} className="mr-1" />
                            {note.url_display_text || "Link"}
                          </span>
                        )}
                        
                        {note.time_set && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-950 text-white border border-purple-700 shadow-sm">
                            <Clock size={12} className="mr-1" />
                            {note.time_set.includes(':') ? note.time_set.split(':').slice(0, 2).join(':') : note.time_set}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Image thumbnails */}
                    {note.images && note.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
                        {note.images.map(image => (
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
                        ))}
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
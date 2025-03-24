import React, { useState } from "react";
import { Note } from "@/types/notes";
import { useNotes } from "@/context/NotesContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, Image, Link2, Video, Filter, X } from "lucide-react";

export type FilterType = "time" | "video" | "image" | "discussion" | "link" | null;

interface FilterMenuProps {
  onFilterChange: (filteredNotes: Note[], filterType: FilterType) => void;
}

export default function FilterMenu({ onFilterChange }: FilterMenuProps) {
  const { notes } = useNotes();
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Helper function to get all notes with their children flattened
  const flattenNotes = (notes: Note[]): Note[] => {
    let flatNotes: Note[] = [];
    
    const traverse = (notesArray: Note[]) => {
      for (const note of notesArray) {
        flatNotes.push(note);
        if (note.children && note.children.length > 0) {
          traverse(note.children);
        }
      }
    };
    
    traverse(notes);
    return flatNotes;
  };
  
  const applyFilter = (
    filterType: FilterType,
    predicate: (note: Note) => boolean
  ) => {
    setActiveFilter(filterType);
    
    if (!filterType) {
      onFilterChange([], null);
      return;
    }
    
    const allNotes = flattenNotes(notes);
    const filtered = allNotes.filter(predicate);
    onFilterChange(filtered, filterType);
  };
  
  const handleFilterSelect = (filterType: FilterType) => {
    switch (filterType) {
      case "time":
        applyFilter("time", (note) => !!note.time_set);
        break;
      case "video":
        applyFilter("video", (note) => !!note.youtube_url);
        break;
      case "image":
        applyFilter("image", (note) => !!(note.images && note.images.length > 0));
        break;
      case "discussion":
        applyFilter("discussion", (note) => !!note.is_discussion);
        break;
      case "link":
        applyFilter("link", (note) => !!note.url);
        break;
      default:
        applyFilter(null, () => false);
        break;
    }
    
    // Close menu when a filter is selected
    setMenuOpen(false);
  };
  
  const getFilterIcon = (filterType: FilterType) => {
    switch (filterType) {
      case "time": return <Clock className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "image": return <Image className="h-4 w-4" />;
      case "discussion": return <MessageSquare className="h-4 w-4" />;
      case "link": return <Link2 className="h-4 w-4" />;
      default: return <Filter className="h-4 w-4" />;
    }
  };
  
  const getFilterLabel = (filterType: FilterType): string => {
    switch (filterType) {
      case "time":
        return "Notes with time";
      case "video":
        return "Notes with videos";
      case "image":
        return "Notes with images";
      case "discussion":
        return "Discussion notes";
      case "link":
        return "Notes with links";
      default:
        return "Filter notes";
    }
  };
  
  // This function directly handles the filter button click outside of the dropdown
  const handleFilterButtonClick = (e: React.MouseEvent) => {
    if (activeFilter) {
      // If filter is active, just turn it off directly
      e.preventDefault(); // Prevent dropdown from opening
      handleFilterSelect(null);
      return;
    }
    // If no active filter, let the dropdown open normally
  };
  
  return (
    <DropdownMenu open={menuOpen} onOpenChange={(open) => {
      // Only allow opening the menu if there's no active filter
      if (activeFilter && open) {
        return; // Don't open if there's an active filter
      }
      setMenuOpen(open);
    }}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleFilterButtonClick}
          className={`h-8 w-8 rounded-full ${
            activeFilter 
              ? 'text-primary bg-primary/20 hover:bg-primary/30 ring-1 ring-primary/40' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
          title={activeFilter ? `${getFilterLabel(activeFilter)} (Click to clear)` : "Filter notes"}
        >
          {activeFilter ? (
            <div className="relative">
              {getFilterIcon(activeFilter)}
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 bg-primary/90 rounded-full items-center justify-center">
                <X className="h-2 w-2 text-white" />
              </span>
            </div>
          ) : (
            <Filter className="h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-gray-900 border-gray-800 text-gray-100">
        <DropdownMenuLabel className="text-gray-400">Filter Notes By</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuRadioGroup value={activeFilter || ""} onValueChange={(value) => handleFilterSelect(value as FilterType || null)}>
          <DropdownMenuRadioItem 
            value="time"
            className="flex items-center gap-2 focus:bg-gray-800 focus:text-white"
          >
            <Clock className="h-4 w-4" />
            <span>Notes with time</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem 
            value="video"
            className="flex items-center gap-2 focus:bg-gray-800 focus:text-white"
          >
            <Video className="h-4 w-4" />
            <span>Notes with videos</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem 
            value="image"
            className="flex items-center gap-2 focus:bg-gray-800 focus:text-white"
          >
            <Image className="h-4 w-4" />
            <span>Notes with images</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem 
            value="discussion"
            className="flex items-center gap-2 focus:bg-gray-800 focus:text-white"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Discussion notes</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem 
            value="link"
            className="flex items-center gap-2 focus:bg-gray-800 focus:text-white"
          >
            <Link2 className="h-4 w-4" />
            <span>Notes with links</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
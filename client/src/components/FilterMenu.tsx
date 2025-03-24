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
import { Clock, MessageSquare, Image, Link2, Video, Filter } from "lucide-react";

export type FilterType = "time" | "video" | "image" | "discussion" | "link" | null;

interface FilterMenuProps {
  onFilterChange: (filteredNotes: Note[], filterType: FilterType) => void;
}

export default function FilterMenu({ onFilterChange }: FilterMenuProps) {
  const { notes } = useNotes();
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  
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
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={`flex items-center ${activeFilter ? 'text-primary' : 'text-gray-400'}`}
          title={activeFilter ? getFilterLabel(activeFilter) : "Filter notes"}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline-block ml-1.5">{activeFilter ? getFilterLabel(activeFilter) : "Filter"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-gray-900 border-gray-800 text-gray-100">
        <DropdownMenuLabel className="text-gray-400">Filter Notes By</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-800" />
        <DropdownMenuRadioGroup value={activeFilter || ""} onValueChange={(value) => handleFilterSelect(value as FilterType || null)}>
          <DropdownMenuRadioItem 
            value="" 
            className="flex items-center gap-2 focus:bg-gray-800 focus:text-white"
          >
            <Filter className="h-4 w-4" />
            <span>Show all notes</span>
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator className="bg-gray-800" />
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
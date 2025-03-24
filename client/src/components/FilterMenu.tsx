import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterIcon } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { Note } from "@/types/notes";

export type FilterType = "time" | "video" | "image" | "discussion" | "link" | null;

interface FilterMenuProps {
  onFilterChange: (filteredNotes: Note[], filterType: FilterType) => void;
}

export default function FilterMenu({ onFilterChange }: FilterMenuProps) {
  const { notes } = useNotes();
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);

  const findAllNotesWithAttribute = (
    notesArray: Note[],
    filterType: FilterType,
    results: Note[] = []
  ): Note[] => {
    for (const note of notesArray) {
      // Check if the note matches the filter criteria
      let shouldInclude = false;
      
      switch (filterType) {
        case "time":
          shouldInclude = !!note.time_set;
          break;
        case "video":
          shouldInclude = !!note.youtube_url;
          break;
        case "image":
          shouldInclude = !!note.images && note.images.length > 0;
          break;
        case "discussion":
          shouldInclude = !!note.is_discussion;
          break;
        case "link":
          shouldInclude = !!note.url;
          break;
        default:
          shouldInclude = false;
      }
      
      if (shouldInclude) {
        results.push(note);
      }
      
      // Recursively search through children
      if (note.children && note.children.length > 0) {
        findAllNotesWithAttribute(note.children, filterType, results);
      }
    }
    
    return results;
  };

  const handleFilterSelect = (filterType: FilterType) => {
    // If selecting the already active filter, clear it
    if (activeFilter === filterType) {
      setActiveFilter(null);
      onFilterChange([], null);
      return;
    }
    
    setActiveFilter(filterType);
    
    if (filterType) {
      const filteredResults = findAllNotesWithAttribute(notes, filterType);
      onFilterChange(filteredResults, filterType);
    } else {
      onFilterChange([], null);
    }
  };

  const getFilterLabel = (filterType: FilterType): string => {
    switch (filterType) {
      case "time":
        return "Time set";
      case "video":
        return "YouTube videos";
      case "image":
        return "Images";
      case "discussion":
        return "Discussions";
      case "link":
        return "Links";
      default:
        return "Show all notes with...";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4" />
          {activeFilter ? getFilterLabel(activeFilter) : "Show all notes with..."}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by attribute</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={activeFilter === "time"}
          onCheckedChange={() => handleFilterSelect("time")}
        >
          Time set
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "video"}
          onCheckedChange={() => handleFilterSelect("video")}
        >
          YouTube videos
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "image"}
          onCheckedChange={() => handleFilterSelect("image")}
        >
          Images
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "discussion"}
          onCheckedChange={() => handleFilterSelect("discussion")}
        >
          Discussions
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={activeFilter === "link"}
          onCheckedChange={() => handleFilterSelect("link")}
        >
          Links
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
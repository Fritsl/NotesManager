import React, { useState } from "react";
import { Note } from "@/types/notes";
import { FilterType } from "./FilterMenu";
import { useNotes } from "@/context/NotesContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, Image, Link2, Video } from "lucide-react";
import { levelColors } from "@/lib/level-colors";

interface FilteredNotesViewProps {
  filteredNotes: Note[];
  filterType: FilterType;
}

export default function FilteredNotesView({ filteredNotes, filterType }: FilteredNotesViewProps) {
  const { selectNote } = useNotes();

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

  const handleNoteClick = (note: Note) => {
    selectNote(note);
  };

  const getAttributeDetail = (note: Note, type: FilterType) => {
    switch (type) {
      case "time":
        return note.time_set;
      case "video":
        return note.youtube_url;
      case "image":
        return note.images ? `${note.images.length} image${note.images.length === 1 ? "" : "s"}` : "";
      case "link":
        return note.url_display_text || note.url;
      default:
        return "";
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        {getFilterIcon(filterType)}
        <h2 className="text-xl font-bold">{getFilterTitle(filterType)}</h2>
        <Badge variant="outline">{getFilterSubtitle(filteredNotes.length)}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNotes.map((note) => (
          <Card 
            key={note.id} 
            className="cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => handleNoteClick(note)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{note.content}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                {getFilterIcon(filterType)}
                <span>{getAttributeDetail(note, filterType)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {note.is_discussion && (
                <Badge className="mr-2" variant="secondary">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Discussion
                </Badge>
              )}
              {note.time_set && filterType !== "time" && (
                <Badge className="mr-2" variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {note.time_set}
                </Badge>
              )}
              {note.url && filterType !== "link" && (
                <Badge className="mr-2" variant="outline">
                  <Link2 className="h-3 w-3 mr-1" />
                  {note.url_display_text || "Link"}
                </Badge>
              )}
              {note.youtube_url && filterType !== "video" && (
                <Badge className="mr-2" variant="outline">
                  <Video className="h-3 w-3 mr-1" />
                  Video
                </Badge>
              )}
              {note.images && note.images.length > 0 && filterType !== "image" && (
                <Badge className="mr-2" variant="outline">
                  <Image className="h-3 w-3 mr-1" />
                  {note.images.length}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
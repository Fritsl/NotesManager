export interface Note {
  id: string;
  content: string;
  position: number;
  is_discussion: boolean;
  time_set: string | null;
  youtube_url: string | null;
  url: string | null;
  url_display_text: string | null;
  children: Note[];
}

export interface NotesData {
  notes: Note[];
}

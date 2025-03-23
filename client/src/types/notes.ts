export interface NoteImage {
  id: string;
  note_id: string;
  storage_path: string;
  url: string;
  position: number;
  created_at: string;
}

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
  images?: NoteImage[];
}

export interface NotesData {
  notes: Note[];
}

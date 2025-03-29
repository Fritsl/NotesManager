export interface NoteImage {
  id?: string;          // Optional in simplified format used by other apps
  note_id?: string;     // Optional in simplified format used by other apps
  storage_path: string; // Required in both formats
  url: string;          // Required in both formats
  position: number;     // Required in both formats 
  created_at?: string;  // Optional in simplified format used by other apps
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

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
  
  // Color is now a numeric value (0-5)
  // 0 or null = transparent (default)
  // 1 = red, 2 = yellow, 3 = green, 4 = blue, 5 = purple
  color?: number | null;
  
  // Legacy support for string color values (will be converted to numeric)
  color_str?: string | null;
}

export interface NotesData {
  notes: Note[];
}

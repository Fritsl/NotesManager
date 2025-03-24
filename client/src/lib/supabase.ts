import { createClient } from '@supabase/supabase-js';

// Define a simple Database type here to avoid import issues
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          last_modified_at: string;
          deleted_at: string | null;
          title: string;
          description?: string;
          user_id: string;
          note_count?: number;
          last_level?: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_modified_at?: string;
          deleted_at?: string | null;
          title: string;
          description?: string;
          user_id: string;
          note_count?: number;
          last_level?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          last_modified_at?: string;
          deleted_at?: string | null;
          title?: string;
          description?: string;
          user_id?: string;
          note_count?: number;
          last_level?: number;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          parent_id: string | null;
          position: number;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          parent_id?: string | null;
          position: number;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          parent_id?: string | null;
          position?: number;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      note_images: {
        Row: {
          id: string;
          note_id: string;
          storage_path: string;
          url: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          storage_path: string;
          url: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          storage_path?: string;
          url?: string;
          position?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Use environment variables
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);
import { createClient } from '@supabase/supabase-js';

// Define database schema typing
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

// Supabase configuration
// Use environment variables for security in production
const supabaseUrl = 'https://mwrznucguduwrqplzfwr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13cnpudWNndWR1d3JxcGx6ZndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyMDY1NzEsImV4cCI6MjAyNjc4MjU3MX0.0NTaLoJkLkIRchyXAKJ0VtJuwGf3HxhUHHmyW9A-nBM';

// Create Supabase client
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          user_id: string
          data: Json
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          user_id: string
          data: Json
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          user_id?: string
          data?: Json
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
import { supabase } from './supabase';
import { NotesData } from '../types/notes';

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  data: NotesData;
}

export async function getProjects(): Promise<Project[]> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return [];
    }
    
    // Query settings table for projects belonging to the current user
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userData.user.id)
      .is('deleted_at', null) // Only get non-deleted projects
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }

    // Map settings table fields to Project interface
    const projects = data?.map(item => ({
      id: item.id,
      name: item.title || 'Untitled Project',
      created_at: item.created_at,
      updated_at: item.updated_at,
      user_id: item.user_id,
      data: item.metadata?.notes_data || { notes: [] }
    })) || [];

    return projects;
  } catch (error) {
    console.error('Error in getProjects:', error);
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    // Query settings table for project belonging to current user
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      return null;
    }

    // Map settings table fields to Project interface
    if (data) {
      return {
        id: data.id,
        name: data.title || 'Untitled Project',
        created_at: data.created_at,
        updated_at: data.updated_at,
        user_id: data.user_id,
        data: data.metadata?.notes_data || { notes: [] }
      };
    }

    return null;
  } catch (error) {
    console.error('Error in getProject:', error);
    return null;
  }
}

export async function createProject(name: string, notesData: NotesData): Promise<Project | null> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    const now = new Date().toISOString();
    
    // Format data for settings table
    const { data, error } = await supabase
      .from('settings')
      .insert({
        title: name,
        user_id: userData.user.id,
        created_at: now,
        updated_at: now,
        last_modified_at: now,
        metadata: { notes_data: notesData }
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return null;
    }

    // Map settings data to Project interface
    return {
      id: data.id,
      name: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id,
      data: data.metadata?.notes_data || { notes: [] }
    };
  } catch (error) {
    console.error('Error in createProject:', error);
    return null;
  }
}

export async function updateProject(id: string, name: string, notesData: NotesData): Promise<Project | null> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return null;
    }
    
    const now = new Date().toISOString();
    
    // Update project in settings table
    const { data, error } = await supabase
      .from('settings')
      .update({
        title: name,
        updated_at: now,
        last_modified_at: now,
        metadata: { notes_data: notesData }
      })
      .eq('id', id)
      .eq('user_id', userData.user.id) // Ensure user can only update their own projects
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error updating project:', error);
      return null;
    }

    // Map settings data to Project interface
    return {
      id: data.id,
      name: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id,
      data: data.metadata?.notes_data || { notes: [] }
    };
  } catch (error) {
    console.error('Error in updateProject:', error);
    return null;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.error('User not authenticated:', userError);
      return false;
    }
    
    // Use soft delete (set deleted_at) instead of actual deletion
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('settings')
      .update({
        deleted_at: now,
        updated_at: now
      })
      .eq('id', id)
      .eq('user_id', userData.user.id); // Ensure user can only delete their own projects

    if (error) {
      console.error('Error deleting project:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteProject:', error);
    return false;
  }
}
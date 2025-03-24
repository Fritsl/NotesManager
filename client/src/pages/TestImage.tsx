import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

// Test component for image uploads
export default function TestImage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [rlsTest, setRlsTest] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [uploadResponse, setUploadResponse] = useState<any>(null);
  const [imageId, setImageId] = useState<string>('');
  const [newPosition, setNewPosition] = useState<number>(0);
  const [updateResponse, setUpdateResponse] = useState<any>(null);
  const [userNotes, setUserNotes] = useState<{id: string, content: string}[]>([]);

  useEffect(() => {
    // Get current user ID on component mount
    const getUserId = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        // Once we have user ID, fetch their notes
        fetchUserNotes(data.user.id);
      }
    };

    getUserId();
    fetchDiagnostics();
  }, []);
  
  // Fetch user's notes to provide valid note IDs for testing
  const fetchUserNotes = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('id, content')
        .eq('user_id', userId)
        .limit(5);
        
      if (error) {
        console.error('Error fetching notes:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setUserNotes(data);
        // Auto-select the first note ID to make testing easier
        setNoteId(data[0].id);
      } else {
        console.log('No notes found, will create a test note');
        createTestNote(userId);
      }
    } catch (error) {
      console.error('Error in fetchUserNotes:', error);
    }
  };
  
  // Create a test note if user doesn't have any
  const createTestNote = async (userId: string) => {
    try {
      // First check if the user has any projects
      const { data: projects, error: projectsError } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', userId)
        .eq('deleted_at', null)
        .limit(1);
        
      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
        return;
      }
      
      let projectId: string;
      
      // If no projects exist, create one
      if (!projects || projects.length === 0) {
        const { data: newProject, error: newProjectError } = await supabase
          .from('settings')
          .insert({
            user_id: userId,
            title: 'Test Project',
            last_modified_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (newProjectError || !newProject) {
          console.error('Error creating test project:', newProjectError);
          return;
        }
        
        projectId = newProject.id;
      } else {
        projectId = projects[0].id;
      }
      
      // Now create a test note in this project
      const { data: newNote, error: newNoteError } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          project_id: projectId,
          content: 'Test note for image uploads',
          position: 0
        })
        .select()
        .single();
        
      if (newNoteError || !newNote) {
        console.error('Error creating test note:', newNoteError);
        return;
      }
      
      // Update state with the new note
      setUserNotes([newNote]);
      setNoteId(newNote.id);
      
      toast({
        title: 'Test Note Created',
        description: 'Created a note for testing image uploads'
      });
    } catch (error) {
      console.error('Error in createTestNote:', error);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const response = await fetch('/api/supabase-diagnostics');
      const data = await response.json();
      setDiagnostics(data);
    } catch (error) {
      console.error('Error fetching diagnostics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch diagnostics',
        variant: 'destructive',
      });
    }
  };

  const testRls = async () => {
    try {
      const response = await fetch(`/api/test-rls${noteId ? `?noteId=${noteId}` : ''}`);
      const data = await response.json();
      setRlsTest(data);
    } catch (error) {
      console.error('Error testing RLS:', error);
      toast({
        title: 'Error',
        description: 'Failed to test RLS',
        variant: 'destructive',
      });
    }
  };

  const uploadToBucket = async () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a file first',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      
      // Generate a unique filename
      const fileName = `${Date.now()}.jpg`;
      const filePath = `images/${fileName}`;
      
      // Upload directly to storage bucket
      const { data, error } = await supabase.storage
        .from('note-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
        
      if (error) {
        throw error;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);
        
      setImageUrl(publicUrl);
      
      toast({
        title: 'Success',
        description: 'File uploaded to bucket successfully',
      });
    } catch (error: any) {
      console.error('Error uploading:', error);
      toast({
        title: 'Upload Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadViaApi = async () => {
    if (!file || !noteId) {
      toast({
        title: 'Error',
        description: 'Please select a file and enter a note ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('noteId', noteId);
      formData.append('userId', userId || 'unknown');
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      setUploadResponse(data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }
      
      setImageUrl(data.url);
      setImageId(data.id); // Save the image ID for position updating
      
      toast({
        title: 'Success',
        description: 'File uploaded via API successfully',
      });
    } catch (error: any) {
      console.error('Error uploading via API:', error);
      toast({
        title: 'Upload Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };
  
  const updateImagePosition = async () => {
    if (!imageId || !noteId) {
      toast({
        title: 'Error',
        description: 'Please upload an image or enter image ID and note ID',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const response = await fetch('/api/update-image-position', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageId,
          noteId,
          userId,
          newPosition
        })
      });
      
      const data = await response.json();
      setUpdateResponse(data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update image position');
      }
      
      toast({
        title: 'Success',
        description: `Image position updated to ${newPosition}`,
      });
    } catch (error: any) {
      console.error('Error updating image position:', error);
      toast({
        title: 'Update Error',
        description: error.message || 'Failed to update image position',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold">Image Upload Test</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Supabase Diagnostics</CardTitle>
          <CardDescription>Connection and storage bucket information</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchDiagnostics}>Refresh Diagnostics</Button>
          <div className="mt-4 p-4 bg-slate-800 text-white rounded-md overflow-auto max-h-64">
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Your Notes</CardTitle>
          <CardDescription>Select a note to use for image tests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userNotes.length > 0 ? (
              <div className="grid gap-2">
                {userNotes.map(note => (
                  <div 
                    key={note.id} 
                    className={`p-3 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${noteId === note.id ? 'bg-blue-100 dark:bg-blue-900 border-blue-500' : ''}`}
                    onClick={() => setNoteId(note.id)}
                  >
                    <p className="font-medium">{note.content.substring(0, 50)}{note.content.length > 50 ? '...' : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ID: {note.id}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 border rounded bg-gray-50 dark:bg-gray-800">
                <p>No notes found. A test note will be created automatically when you sign in.</p>
              </div>
            )}
            
            <div>
              <Label htmlFor="note-id">Note ID</Label>
              <Input
                id="note-id"
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                placeholder="Selected note ID will appear here"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>RLS Policy Test</CardTitle>
          <CardDescription>Test Row Level Security policies on note_images table</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={testRls} disabled={!noteId}>Test RLS Policies</Button>
            {rlsTest && (
              <div className="mt-4 p-4 bg-slate-800 text-white rounded-md overflow-auto max-h-64">
                <pre>{JSON.stringify(rlsTest, null, 2)}</pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>Test image uploads both directly to bucket and via API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select Image</Label>
              <Input 
                id="file" 
                type="file" 
                accept="image/*" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
              />
            </div>
            
            <div>
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="User ID will be auto-filled if logged in"
              />
            </div>
            
            <div>
              <Label htmlFor="note-id-upload">Note ID (required for API upload)</Label>
              <Input
                id="note-id-upload"
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                placeholder="Enter note ID for upload"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={uploadToBucket} disabled={uploading || !file}>
            {uploading ? 'Uploading...' : 'Upload to Bucket Directly'}
          </Button>
          <Button onClick={uploadViaApi} disabled={uploading || !file || !noteId}>
            {uploading ? 'Uploading...' : 'Upload via API'}
          </Button>
        </CardFooter>
      </Card>
      
      {imageUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Image</CardTitle>
          </CardHeader>
          <CardContent>
            <img 
              src={imageUrl} 
              alt="Uploaded" 
              className="max-w-full h-auto max-h-96 mx-auto border rounded" 
            />
          </CardContent>
        </Card>
      )}
      
      {uploadResponse && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-800 text-white rounded-md overflow-auto max-h-64">
              <pre>{JSON.stringify(uploadResponse, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Update Image Position</CardTitle>
          <CardDescription>Test updating image position via API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-id">Image ID</Label>
              <Input
                id="image-id"
                value={imageId}
                onChange={(e) => setImageId(e.target.value)}
                placeholder="Enter image ID or upload an image first"
              />
            </div>
            
            <div>
              <Label htmlFor="position">New Position</Label>
              <Input
                id="position"
                type="number"
                min="0"
                value={newPosition}
                onChange={(e) => setNewPosition(parseInt(e.target.value))}
                placeholder="Enter new position (number)"
              />
            </div>
            
            <Button 
              onClick={updateImagePosition} 
              disabled={!imageId || !noteId || !userId}
            >
              Update Image Position
            </Button>
          </div>
          
          {updateResponse && (
            <div className="mt-4 p-4 bg-slate-800 text-white rounded-md overflow-auto max-h-64">
              <pre>{JSON.stringify(updateResponse, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
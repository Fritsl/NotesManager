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

  useEffect(() => {
    // Get current user ID on component mount
    const getUserId = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      }
    };

    getUserId();
    fetchDiagnostics();
  }, []);

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
          <CardTitle>RLS Policy Test</CardTitle>
          <CardDescription>Test Row Level Security policies on note_images table</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-id">Note ID (optional)</Label>
              <Input
                id="note-id"
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                placeholder="Enter note ID for RLS test"
              />
            </div>
            <Button onClick={testRls}>Test RLS Policies</Button>
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
    </div>
  );
}
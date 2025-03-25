import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uniqueId } from '@/lib/utils';

interface TestImage {
  id: string;
  note_id: string;
  storage_path: string;
  url: string;
  position: number;
  created_at: string;
}

export default function ImageTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<TestImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchImages();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const fetchImages = async () => {
    try {
      setLoading(true);
      
      // Use note_images table instead of test_images since it exists in schema
      console.log("Querying for existing data with Supabase client...");
      const { data, error } = await supabase
        .from('note_images')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log("Query result:", data, "Error:", error);
      
      // Return empty array but don't throw an error to let the page render
      if (error) {
        console.error("Error fetching data from Supabase:", error);
        return [];
      }
      
      setImages(data || []);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        title: 'Error fetching images',
        description: 'Could not load the test images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      
      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${uniqueId()}.${fileExt}`;
      const filePath = `test_images/${fileName}`;
      
      // Step 1: Upload the file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('note-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Step 2: Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath);
      
      // Step 3: Create a record in the note_images table (using a test note_id)
      const testNoteId = 'test-' + uniqueId();
      const { data: imageRecord, error: dbError } = await supabase
        .from('note_images')
        .insert([
          {
            note_id: testNoteId,
            storage_path: filePath,
            url: publicUrl,
            position: 0
          }
        ])
        .select()
        .single();
      
      if (dbError) {
        // If database insert fails, also delete the uploaded file
        await supabase.storage
          .from('note-images')
          .remove([filePath]);
        throw dbError;
      }
      
      toast({
        title: 'Upload successful',
        description: 'Image was uploaded successfully',
      });
      
      // Refresh the image list
      await fetchImages();
      
      // Clear the file input
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (image: TestImage) => {
    try {
      setDeleting(image.id);
      
      // Step 1: Delete the record from the database
      const { error: dbError } = await supabase
        .from('note_images')
        .delete()
        .eq('id', image.id);
      
      if (dbError) {
        throw dbError;
      }
      
      // Step 2: Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('note-images')
        .remove([image.storage_path]);
      
      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // We'll still consider the operation successful if the DB record was deleted
        // but log the storage error for debugging
      }
      
      toast({
        title: 'Image deleted',
        description: 'Image was removed successfully',
      });
      
      // Update the UI by filtering out the deleted image
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Image Upload Test Page</h1>
      
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Test Image</CardTitle>
            <CardDescription>Test the direct Supabase image upload functionality</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input 
                id="file-upload"
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                disabled={uploading}
              />
              <Button 
                onClick={uploadImage} 
                disabled={!file || uploading}
                className="whitespace-nowrap"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Test Images</CardTitle>
              <CardDescription>Images uploaded for testing</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchImages} 
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No test images found. Upload some images to test.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="relative group border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                    <img 
                      src={image.url} 
                      alt={`Test image ${image.id}`} 
                      className="w-full aspect-square object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/400x400/gray/white?text=Image+Error';
                      }}
                    />
                    <div className="p-2 text-xs text-gray-500 truncate">
                      <div>Path: {image.storage_path}</div>
                      <div>Note ID: {image.note_id}</div>
                      <div>Position: {image.position}</div>
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteImage(image)}
                        disabled={deleting === image.id}
                      >
                        {deleting === image.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                      {new Date(image.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="text-sm text-gray-500">
            Total: {images.length} test images
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Technical details about the image upload process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Image Upload Process:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>File is selected via the file input</li>
                <li>File is uploaded directly to Supabase storage 'note-images' bucket with a unique name</li>
                <li>Public URL is generated for the uploaded file</li>
                <li>Image record is created in the 'note_images' table with note_id, storage_path, URL and position</li>
                <li>Image list is refreshed to show the newly uploaded image</li>
              </ol>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Image Deletion Process:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Image record is deleted from the 'note_images' table</li>
                <li>File is removed from the Supabase storage 'note-images' bucket</li>
                <li>Image is removed from the UI without refreshing the entire list</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
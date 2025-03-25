import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { migrateLocalImages } from '@/lib/projectService';

// Diagnostics page for debugging image storage and display issues
export default function ImageDiagnostics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageItems, setStorageItems] = useState<any[]>([]);
  const [imageRecords, setImageRecords] = useState<any[]>([]);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [filter, setFilter] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('original');

  // Load image data
  useEffect(() => {
    if (!user) return;
    
    async function loadData() {
      setLoading(true);
      try {
        // Get storage items
        const { data: storageData, error: storageError } = await supabase.storage
          .from('note-images')
          .list('images', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          });
          
        if (storageError) {
          console.error('Storage list error:', storageError);
        } else {
          setStorageItems(storageData || []);
        }
        
        // Get database records
        const { data: recordsData, error: recordsError } = await supabase
          .from('note_images')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
          
        if (recordsError) {
          console.error('Records fetch error:', recordsError);
        } else {
          setImageRecords(recordsData || []);
        }
      } catch (error) {
        console.error('Error loading diagnostic data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [user, refreshing]);

  // Filter records based on search input
  const filteredRecords = imageRecords.filter(record => {
    if (!filter) return true;
    const lowerFilter = filter.toLowerCase();
    return (
      record.id.toLowerCase().includes(lowerFilter) ||
      record.note_id.toLowerCase().includes(lowerFilter) ||
      record.storage_path.toLowerCase().includes(lowerFilter) ||
      record.url.toLowerCase().includes(lowerFilter)
    );
  });

  // Run migration process
  const handleMigrate = async () => {
    try {
      setMigrationResult(null);
      const result = await migrateLocalImages();
      setMigrationResult(result);
      setRefreshing(prev => !prev);
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationResult({ error: String(error) });
    }
  };

  // Handle format migration (fix URL formats)
  const updateImageFormat = async () => {
    if (!window.confirm('This will update the format of all image records. Continue?')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/update-image-format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: selectedFormat
        }),
      });
      
      const result = await response.json();
      alert(`Updated ${result.count} image records to ${selectedFormat} format`);
      setRefreshing(prev => !prev);
    } catch (error) {
      console.error('Format update error:', error);
      alert('Error updating image formats: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const handleRefresh = () => {
    setRefreshing(prev => !prev);
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Image Diagnostics</h1>
        <p className="text-gray-700 dark:text-gray-300">Please log in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Image Diagnostics</h1>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="outline">Back to App</Button>
          </Link>
          <Button variant="secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Data'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Storage</CardTitle>
            <CardDescription>Files in Supabase storage (note-images bucket)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-700 dark:text-gray-300">Loading storage data...</p>
            ) : (
              <ScrollArea className="h-[300px]">
                <ul className="space-y-2">
                  {storageItems.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">No files found in storage</p>
                  ) : (
                    storageItems.map((item, i) => (
                      <li key={i} className="p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                        <div className="text-sm">
                          Size: {Math.round(item.metadata?.size / 1024)} KB
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter>
            <div className="text-sm">
              Total: {storageItems.length} files
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Records</CardTitle>
            <CardDescription>Records in the note_images table</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Filter by ID, note ID, or path..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            {loading ? (
              <p>Loading image records...</p>
            ) : (
              <ScrollArea className="h-[300px]">
                <ul className="space-y-2">
                  {filteredRecords.length === 0 ? (
                    <p>No image records found</p>
                  ) : (
                    filteredRecords.map((record) => (
                      <li key={record.id} className="p-2 border rounded">
                        <div className="font-medium truncate">{record.id}</div>
                        <div className="text-sm">Note: {record.note_id}</div>
                        <div className="text-sm truncate">Path: {record.storage_path}</div>
                        <div className="text-sm text-gray-500">
                          Position: {record.position}
                        </div>
                        <div className="text-sm mt-1">
                          <a 
                            href={record.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-blue-500 hover:underline"
                          >
                            View Image
                          </a>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter>
            <div className="text-sm">
              Showing {filteredRecords.length} of {imageRecords.length} records
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Fix Image Formats</CardTitle>
            <CardDescription>
              Update image records to ensure compatibility with other applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  Select URL Format
                </label>
                <select
                  className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                >
                  <option value="original">Original App Format</option>
                  <option value="replit">Replit App Format</option>
                </select>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-900 dark:text-gray-100">
                <p className="font-medium">Format Examples:</p>
                <p><strong>Original App:</strong> Path: images/filename.jpg</p>
                <p><strong>Replit App:</strong> Path: images/user_id/filename.jpg</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={updateImageFormat} disabled={loading}>
              Update All Image Records
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Migration</CardTitle>
            <CardDescription>
              Migrate local images to Supabase storage and fix URL formats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleMigrate} disabled={loading} className="mb-4">
              Run Migration
            </Button>
            
            {migrationResult && (
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100">
                <h3 className="font-medium mb-2">Migration Result:</h3>
                <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-[200px] bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  {JSON.stringify(migrationResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { migrateLocalImages } from '@/lib/projectService';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  // Get counts of problematic images
  const imagePathStats = React.useMemo(() => {
    const stats = {
      total: imageRecords.length,
      duplicatePaths: 0,
      wrongFormat: 0,
      duplicateUrls: 0,
      correctFormat: 0
    };
    
    imageRecords.forEach(record => {
      if (!record.storage_path) return;
      
      if (record.storage_path.includes('/images/images/') || record.storage_path.includes('images/images/')) {
        stats.duplicatePaths++;
      } else if (!record.storage_path.startsWith('images/')) {
        stats.wrongFormat++;
      } else if (record.storage_path.match(/^images\/[^\/]+\.[a-zA-Z0-9]+$/)) {
        stats.correctFormat++;
      } else {
        stats.wrongFormat++;
      }
      
      if (record.url && record.url.includes('/images/images/')) {
        stats.duplicateUrls++;
      }
    });
    
    return stats;
  }, [imageRecords]);
  
  // Fix duplicate image paths directly in Supabase
  const fixDuplicateImagePaths = async () => {
    if (!window.confirm('This will update all records with duplicate "images/" paths. Continue?')) {
      return;
    }
    
    setLoading(true);
    try {
      // For each problematic record, update it
      let fixedCount = 0;
      let errorCount = 0;
      
      for (const record of imageRecords) {
        // Check if this record has the duplicate path issue
        if (record.storage_path && (
            record.storage_path.includes('/images/images/') || 
            record.storage_path.includes('images/images/')
        )) {
          // Fix the storage path
          const fixedPath = record.storage_path.replace(/images\/images\//g, 'images/');
          
          // Update the record
          const { error } = await supabase
            .from('note_images')
            .update({ storage_path: fixedPath })
            .eq('id', record.id);
            
          if (error) {
            console.error(`Error fixing path for record ${record.id}:`, error);
            errorCount++;
          } else {
            fixedCount++;
          }
        }
        
        // Check if this record has a URL with duplicate path
        if (record.url && record.url.includes('/images/images/')) {
          // Fix the URL
          const fixedUrl = record.url.replace(/\/images\/images\//g, '/images/');
          
          // Update the record
          const { error } = await supabase
            .from('note_images')
            .update({ url: fixedUrl })
            .eq('id', record.id);
            
          if (error) {
            console.error(`Error fixing URL for record ${record.id}:`, error);
            errorCount++;
          } else if (!record.storage_path.includes('/images/images/') && !record.storage_path.includes('images/images/')) {
            // Only count if we haven't already counted this record for path fixes
            fixedCount++;
          }
        }
      }
      
      if (errorCount > 0) {
        alert(`Fixed ${fixedCount} records with ${errorCount} errors. See console for details.`);
      } else {
        alert(`Successfully fixed ${fixedCount} records with duplicate paths/URLs.`);
      }
      
      // Refresh the data
      setRefreshing(prev => !prev);
    } catch (error) {
      console.error('Error fixing image paths:', error);
      alert('Error fixing image paths: ' + String(error));
    } finally {
      setLoading(false);
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(item.created_at).toLocaleString()}
                            </div>
                            <div className="text-sm">
                              Size: {Math.round(item.metadata?.size / 1024)} KB
                            </div>
                          </div>
                          <div className="flex flex-col items-start justify-start">
                            <div className="text-sm font-medium mb-1">Storage Info:</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                              <span className="font-semibold">Location:</span> note-images/{item.name}
                            </div>
                            <div className="text-xs mt-1 mb-2">
                              <span className="font-semibold">Full Path:</span>
                              <code className="ml-1 p-1 bg-gray-100 dark:bg-gray-700 rounded text-xs break-all">
                                https://wxpdstlzutwzuxstysnl.supabase.co/storage/v1/object/public/note-images/{item.name}
                              </code>
                            </div>
                            <div className="text-xs">
                              <a 
                                href={`https://wxpdstlzutwzuxstysnl.supabase.co/storage/v1/object/public/note-images/${item.name}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                              >
                                Open in New Tab
                              </a>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter>
            <div className="text-sm text-gray-700 dark:text-gray-300">
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
              <p className="text-gray-700 dark:text-gray-300">Loading image records...</p>
            ) : (
              <ScrollArea className="h-[300px]">
                <ul className="space-y-2">
                  {filteredRecords.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">No image records found</p>
                  ) : (
                    filteredRecords.map((record) => (
                      <li key={record.id} className="p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-medium truncate">{record.id}</div>
                            <div className="text-sm">Note: {record.note_id}</div>
                            <div className="text-sm truncate">Path: {record.storage_path}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Position: {record.position}
                            </div>
                            {/* Removed duplicate link */}
                          </div>
                          <div className="flex flex-col items-start justify-start">
                            <div className="text-sm font-medium mb-1">Image Details:</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                              <span className="font-semibold">URL:</span> {record.url}
                            </div>
                            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400 break-all">
                              <span className="font-semibold">Storage Path:</span> {record.storage_path}
                            </div>
                            
                            {/* Path validation */}
                            {record.storage_path && (
                              <>
                                {!record.storage_path.startsWith('images/') ? (
                                  <div className="text-xs mt-1 bg-red-100 dark:bg-red-900 p-1 rounded flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1 text-red-600 dark:text-red-400" />
                                    <span className="font-semibold text-red-800 dark:text-red-200">
                                      Path should start with "images/"
                                    </span>
                                  </div>
                                ) : record.storage_path.includes('/images/images/') || record.storage_path.includes('images/images/') ? (
                                  <div className="text-xs mt-1 bg-yellow-100 dark:bg-yellow-900 p-1 rounded flex items-center">
                                    <AlertTriangle className="h-3 w-3 mr-1 text-yellow-600 dark:text-yellow-400" />
                                    <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                                      Duplicate "images/" in path
                                    </span>
                                  </div>
                                ) : record.storage_path.match(/^images\/[^\/]+\.[a-zA-Z0-9]+$/) ? (
                                  <div className="text-xs mt-1 bg-green-100 dark:bg-green-900 p-1 rounded flex items-center">
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-600 dark:text-green-400" />
                                    <span className="font-semibold text-green-800 dark:text-green-200">
                                      Correct path format
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-xs mt-1 bg-yellow-100 dark:bg-yellow-900 p-1 rounded flex items-center">
                                    <AlertTriangle className="h-3 w-3 mr-1 text-yellow-600 dark:text-yellow-400" />
                                    <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                                      Should be "images/filename.ext"
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            
                            {/* URL validation */}
                            {record.url && (
                              <>
                                {record.url.includes('/images/images/') && (
                                  <div className="text-xs mt-1 bg-yellow-100 dark:bg-yellow-900 p-1 rounded flex items-center">
                                    <AlertTriangle className="h-3 w-3 mr-1 text-yellow-600 dark:text-yellow-400" />
                                    <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                                      URL contains duplicate "images/" path
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            
                            <div className="mt-2 text-xs flex space-x-2">
                              <a 
                                href={record.url.includes('/images/images/') ? 
                                  // Remove the duplicate 'images/' if present
                                  record.url.replace('/images/images/', '/images/') : 
                                  record.url
                                } 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
                              >
                                Open Image
                              </a>
                              <Badge variant={record.url.includes('/images/images/') ? "destructive" : "outline"}>
                                {record.url.includes('/images/images/') ? 'URL needs fixing' : 'URL format OK'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {filteredRecords.length} of {imageRecords.length} records
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Image Format Summary</CardTitle>
            <CardDescription>
              Overview of image format issues and fix options
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Images</div>
                  <div className="text-lg font-bold">{imagePathStats.total}</div>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded">
                  <div className="text-xs text-green-700 dark:text-green-400">Correct Format</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">{imagePathStats.correctFormat}</div>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-800 rounded">
                  <div className="text-xs text-yellow-700 dark:text-yellow-400">Duplicate Paths</div>
                  <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{imagePathStats.duplicatePaths}</div>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded">
                  <div className="text-xs text-red-700 dark:text-red-400">Wrong Format</div>
                  <div className="text-lg font-bold text-red-700 dark:text-red-400">{imagePathStats.wrongFormat}</div>
                </div>
              </div>

              {/* Alert about expected format */}
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <AlertTitle className="text-blue-800 dark:text-blue-300 font-medium">Required Image Format</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                  <p className="mb-2">All images must follow this exact format for compatibility:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li><strong>Storage Path:</strong> <code className="bg-blue-100 dark:bg-blue-800 p-1 rounded">images/filename.ext</code></li>
                    <li><strong>Public URL:</strong> <code className="bg-blue-100 dark:bg-blue-800 p-1 rounded">https://wxpdstlzutwzuxstysnl.supabase.co/storage/v1/object/public/note-images/images/filename.ext</code></li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Fix options */}
              <div className="flex flex-col space-y-3">
                {imagePathStats.duplicatePaths > 0 && (
                  <Button onClick={fixDuplicateImagePaths} disabled={loading} variant="destructive">
                    Fix {imagePathStats.duplicatePaths} Images with Duplicate Paths/URLs
                  </Button>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    Update All Images to Format:
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                    >
                      <option value="original">Original App Format (images/filename.ext)</option>
                      <option value="replit">Replit App Format (images/user_id/filename.ext)</option>
                    </select>
                    <Button onClick={updateImageFormat} disabled={loading} variant="secondary">
                      Update All Images
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
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
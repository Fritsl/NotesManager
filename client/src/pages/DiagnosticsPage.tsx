import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getProjects } from '../lib/projectService';
import { supabase } from '../lib/supabase';

interface ProjectStat {
  id: string;
  title: string;
  settings_note_count: number;
  db_note_count: number;
  json_file_exists: boolean;
  json_note_count: number;
  last_updated: string;
}

interface DiagnosticsData {
  timestamp: string;
  user_id: string;
  project_count: number;
  projects: ProjectStat[];
  sample_notes: any[];
}

export default function DiagnosticsPage() {
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [dbNotes, setDbNotes] = useState<any[]>([]);
  const [settingsRecords, setSettingsRecords] = useState<any[]>([]);
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadDiagnostics() {
      setIsLoading(true);
      setError(null);
      try {
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          setError('No user authenticated');
          setIsLoading(false);
          return;
        }

        setUserId(userData.user.id);

        // Fetch projects using the project service
        const projectsData = await getProjects();
        setDbProjects(projectsData);

        // Use the server diagnostics endpoint for more detailed information
        try {
          const response = await fetch(`/api/diagnostics?userId=${userData.user.id}`);
          if (response.ok) {
            const serverDiagnostics = await response.json();
            setDiagnosticsData(serverDiagnostics);
            console.log('Server diagnostics:', serverDiagnostics);
          } else {
            console.error('Error fetching server diagnostics:', await response.text());
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          // Continue with basic diagnostics
        }

        // Direct database queries as fallback
        const { data: notes, error: notesError } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', userData.user.id);

        if (notesError) throw notesError;
        setDbNotes(notes || []);

        // Get settings records
        const { data: settings, error: settingsError } = await supabase
          .from('settings')
          .select('*')
          .eq('user_id', userData.user.id);
          
        if (settingsError) throw settingsError;
        setSettingsRecords(settings || []);

      } catch (err: any) {
        console.error('Error loading diagnostics:', err);
        setError(err.message || 'Unknown error loading diagnostics');
      } finally {
        setIsLoading(false);
      }
    }

    loadDiagnostics();
  }, [refreshKey]);

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl text-black dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Database Diagnostics</h1>
        <Button onClick={refreshData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-300">
          <h2 className="text-red-600 font-bold">Error</h2>
          <p>{error}</p>
        </Card>
      )}

      <Card className="p-4 mb-6 text-black bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">User Information</h2>
        <p><strong>Current User ID:</strong> {userId || 'Not authenticated'}</p>
      </Card>

      {diagnosticsData && (
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200 text-black">
          <h2 className="text-lg font-semibold mb-2">Server Diagnostics Summary</h2>
          <p className="mb-2">
            <strong>Projects:</strong> {diagnosticsData.project_count} | 
            <strong className="ml-2">Timestamp:</strong> {new Date(diagnosticsData.timestamp).toLocaleString()}
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-blue-100 text-black">
                  <th className="border p-2 text-left">Project</th>
                  <th className="border p-2 text-left">Database Notes</th>
                  <th className="border p-2 text-left">Settings Count</th>
                  <th className="border p-2 text-left">JSON Count</th>
                  <th className="border p-2 text-left">JSON File</th>
                  <th className="border p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="text-black">
                {diagnosticsData.projects.map(project => {
                  // Determine status
                  let status = 'ok';
                  let statusText = 'OK';
                  
                  if (project.db_note_count !== project.settings_note_count) {
                    status = 'warning';
                    statusText = 'Count Mismatch';
                  }
                  
                  if (project.json_file_exists && project.json_note_count !== project.db_note_count) {
                    status = 'error';
                    statusText = 'JSON/DB Conflict';
                  }
                  
                  return (
                    <tr key={project.id} className="hover:bg-blue-50">
                      <td className="border p-2">
                        <div className="font-semibold">{project.title || 'Untitled'}</div>
                        <div className="text-xs font-mono text-gray-500">{project.id}</div>
                      </td>
                      <td className="border p-2 text-center font-semibold">{project.db_note_count}</td>
                      <td className="border p-2 text-center">{project.settings_note_count}</td>
                      <td className="border p-2 text-center">{project.json_note_count}</td>
                      <td className="border p-2 text-center">
                        {project.json_file_exists ? 
                          <Badge variant="outline" className="bg-green-50">Yes</Badge> : 
                          <Badge variant="outline" className="bg-gray-100">No</Badge>
                        }
                      </td>
                      <td className="border p-2">
                        <Badge className={
                          status === 'ok' ? 'bg-green-100 text-green-800' : 
                          status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }>
                          {statusText}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {diagnosticsData.sample_notes.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Sample Notes from Recent Project</h3>
              <div className="overflow-x-auto max-h-60 overflow-y-auto bg-white rounded border">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="border p-2 text-left">ID</th>
                      <th className="border p-2 text-left">Position</th>
                      <th className="border p-2 text-left">Content</th>
                      <th className="border p-2 text-left">Parent ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticsData.sample_notes.map(note => (
                      <tr key={note.id} className="hover:bg-gray-50">
                        <td className="border p-2 font-mono text-xs">{note.id}</td>
                        <td className="border p-2">{note.position || 0}</td>
                        <td className="border p-2 truncate max-w-xs">{note.content?.substring(0, 40)}{note.content?.length > 40 ? '...' : ''}</td>
                        <td className="border p-2 font-mono text-xs">{note.parent_id || 'null'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card className="p-4 text-black bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Projects from API</h2>
          <p className="mb-2">Total Projects: {dbProjects.length}</p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-black">
                  <th className="border p-2 text-left">ID</th>
                  <th className="border p-2 text-left">Name</th>
                  <th className="border p-2 text-left">Note Count</th>
                  <th className="border p-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="text-black bg-white">
                {dbProjects.map(project => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="border p-2 font-mono text-xs">{project.id}</td>
                    <td className="border p-2">{project.name}</td>
                    <td className="border p-2">{project.note_count || 0}</td>
                    <td className="border p-2">{new Date(project.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
                {dbProjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="border p-2 text-center">No projects found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {dbNotes.length > 0 && (
          <Card className="p-4 text-black bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">Notes in Database (via Supabase)</h2>
            <p className="mb-2">Total Notes: {dbNotes.length}</p>
            
            {/* Group notes by project for better organization */}
            {Object.entries(dbNotes.reduce((acc: any, note) => {
              if (!acc[note.project_id]) acc[note.project_id] = [];
              acc[note.project_id].push(note);
              return acc;
            }, {})).map(([projectId, projectNotes]: [string, any[]]) => (
              <div key={projectId} className="mb-4">
                <h3 className="font-medium mt-4 mb-2">
                  Project: <span className="font-mono text-xs">{projectId}</span>
                  <span className="ml-2">({projectNotes.length} notes)</span>
                </h3>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-black">
                        <th className="border p-2 text-left">ID</th>
                        <th className="border p-2 text-left">Position</th>
                        <th className="border p-2 text-left">Content</th>
                        <th className="border p-2 text-left">Parent ID</th>
                      </tr>
                    </thead>
                    <tbody className="text-black bg-white">
                      {projectNotes.map(note => (
                        <tr key={note.id} className="hover:bg-gray-50">
                          <td className="border p-2 font-mono text-xs">{note.id}</td>
                          <td className="border p-2">{note.position || note.note_position}</td>
                          <td className="border p-2 truncate max-w-xs">{note.content?.substring(0, 40)}{note.content?.length > 40 ? '...' : ''}</td>
                          <td className="border p-2 font-mono text-xs">{note.parent_id || 'null'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {dbNotes.length === 0 && (
              <p className="p-2 text-center bg-gray-50 rounded">No notes found in database</p>
            )}
          </Card>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Common Issues & Solutions</h2>
        <Card className="p-4 text-black bg-gray-50">
          <ul className="list-disc list-inside space-y-2">
            <li>Notes might be stored in the database but not displayed in the app due to different ID formats</li>
            <li>The app might be using JSON files instead of the database for some operations</li>
            <li>Row-Level Security (RLS) policies might be preventing proper access to data</li>
            <li>The app and database might be out of sync (note count doesn't match actual notes)</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
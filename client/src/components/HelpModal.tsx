import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-auto">
      <div className="min-h-screen p-4 sm:p-8 text-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Help & Keyboard Shortcuts</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full">
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Keyboard Shortcuts Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-medium text-primary mb-2">Navigation & Levels</h4>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">Z</kbd>
                      <span>Collapse one level (collapse deeper notes)</span>
                    </div>
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">X</kbd>
                      <span>Expand one more level (show deeper notes)</span>
                    </div>
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">Ctrl+0</kbd>
                      <span>Collapse all notes (Level 0)</span>
                    </div>
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">Ctrl+1-5</kbd>
                      <span>Jump to specific levels (L1-L5)</span>
                    </div>
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">Ctrl+E</kbd>
                      <span>Expand all notes</span>
                    </div>
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">Ctrl+C</kbd>
                      <span>Collapse all notes</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-primary mb-2">Actions</h4>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <kbd className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 min-w-[50px] text-center mr-3">Ctrl+Z</kbd>
                      <span>Undo last note movement</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* General Usage Section */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">How to Use the App</h3>
              <div className="space-y-4 text-gray-300">
                <div>
                  <h4 className="text-lg font-medium text-primary mb-2">Projects</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Create new projects from the burger menu</li>
                    <li>Open existing projects from the projects list</li>
                    <li>Each project has its own set of hierarchical notes</li>
                    <li>Delete projects by selecting "Delete Project" from the menu (they go to trash)</li>
                    <li>Restore deleted projects from the Trash</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-medium text-primary mb-2">Notes</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Add new notes using the "+" buttons</li>
                    <li>Organize notes in a hierarchical tree structure</li>
                    <li>Notes can contain text, images, links and time markers</li>
                    <li>Drag and drop notes to rearrange them</li>
                    <li>Search across all notes using the search bar</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-lg font-medium text-primary mb-2">Filtering</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Filter notes by time, discussion, links, images, or videos</li>
                    <li>Filtered view shows matching notes in a flat list</li>
                    <li>You can still edit notes while in filtered view</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Levels Explanation */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Understanding Levels</h3>
              <div className="space-y-3 text-gray-300">
                <p>The app uses a level system to control how much of your note tree is visible at once:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Level 0:</strong> All notes are collapsed (only shows the root)</li>
                  <li><strong>Level 1:</strong> Shows top-level notes only</li>
                  <li><strong>Level 2:</strong> Shows top-level notes and their immediate children</li>
                  <li><strong>Level 3+:</strong> Shows deeper levels of the hierarchy</li>
                </ul>
                <p>Use the level controls in the header or keyboard shortcuts to navigate between levels easily.</p>
              </div>
            </div>
            
            {/* Tips & Tricks */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Tips & Tricks</h3>
              <div className="space-y-3 text-gray-300">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Use search to quickly find specific notes across your project</li>
                  <li>Add time markers to notes to track when events should occur</li>
                  <li>Include links to external resources directly in your notes</li>
                  <li>Projects are automatically saved as you make changes</li>
                  <li>Use Ctrl+Z or the Undo option in the menu to undo note movements</li>
                  <li>You can export your notes as JSON for backup</li>
                  <li>Import previously exported JSON to restore your notes</li>
                  <li>Regularly check the trash to ensure you haven't deleted something important</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
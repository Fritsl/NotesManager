import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useNotes } from '@/context/NotesContext';

interface SearchResult {
  id: string;
  content: string;
  path: string[];
}

export default function SearchBar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { notes, selectNote, expandedNodes, setExpandedNodes } = useNotes();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search function that traverses the notes tree
  const searchNotes = useCallback((term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: SearchResult[] = [];
    const termLower = term.toLowerCase();

    // Helper function to recursively search through notes
    const searchNode = (note: any, path: string[] = []) => {
      // Check if note content contains the search term
      const contentLower = note.content.toLowerCase();
      if (contentLower.includes(termLower)) {
        // Truncate content if too long
        let matchContent = note.content;
        if (matchContent.length > 100) {
          const matchIndex = contentLower.indexOf(termLower);
          const startIndex = Math.max(0, matchIndex - 40);
          const endIndex = Math.min(note.content.length, matchIndex + term.length + 40);
          matchContent = 
            (startIndex > 0 ? '...' : '') + 
            matchContent.substring(startIndex, endIndex) + 
            (endIndex < matchContent.length ? '...' : '');
        }

        // Add to results
        results.push({
          id: note.id,
          content: matchContent,
          path: [...path, note.content]
        });
      }

      // Search in children
      if (note.children && note.children.length > 0) {
        for (const child of note.children) {
          searchNode(child, [...path, note.content]);
        }
      }
    };

    // Start searching from root notes
    if (notes && notes.length > 0) {
      for (const note of notes) {
        searchNode(note);
      }
    }

    setSearchResults(results);
    setIsSearching(false);
  }, [notes, expandedNodes, setExpandedNodes]);

  // Handle search term change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm) {
        searchNotes(searchTerm);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, searchNotes]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle selecting a result
  const handleSelectResult = (result: SearchResult) => {
    // Find the note in the tree
    const findNote = (noteId: string, notesList: any[]): any => {
      for (const note of notesList) {
        if (note.id === noteId) {
          return note;
        }
        if (note.children && note.children.length > 0) {
          const found = findNote(noteId, note.children);
          if (found) return found;
        }
      }
      return null;
    };

    // Find the path to the note (all parent IDs)
    const findPathToNote = (noteId: string, notesList: any[], path: string[] = []): string[] | null => {
      for (const note of notesList) {
        // Check if this is the target note
        if (note.id === noteId) {
          return [...path, note.id];
        }
        
        // Check children
        if (note.children && note.children.length > 0) {
          const foundPath = findPathToNote(noteId, note.children, [...path, note.id]);
          if (foundPath) return foundPath;
        }
      }
      return null;
    };

    const note = findNote(result.id, notes);
    if (note) {
      // Get path to the note
      const path = findPathToNote(result.id, notes);
      
      // Expand all nodes in the path (excluding the target note itself)
      if (path && path.length > 0) {
        const nodesToExpand = path.slice(0, -1); // Exclude the target note
        
        // Get the current expanded nodes
        const expandedNodesCopy = new Set<string>(expandedNodes);
        
        // Add all parent nodes to the expanded set
        nodesToExpand.forEach(nodeId => {
          expandedNodesCopy.add(nodeId);
        });
        
        // Update expanded nodes
        setExpandedNodes(expandedNodesCopy);
      }
      
      // Select the note
      selectNote(note);
      setShowResults(false);
      
      // Scroll to the selected note after a short delay to ensure DOM updates
      setTimeout(() => {
        const noteElement = document.getElementById(`note-${result.id}`);
        if (noteElement) {
          noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add a brief highlight effect to make it even more obvious
          noteElement.classList.add('highlight-search-result');
          setTimeout(() => {
            noteElement.classList.remove('highlight-search-result');
          }, 2000);
        }
      }, 100);
      
      // Also dispatch an event so other components can be notified about this search result selection
      window.dispatchEvent(new CustomEvent('search-result-selected', { 
        detail: { noteId: result.id }
      }));
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
  };

  // Focus search input
  const focusSearch = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div 
      ref={searchRef} 
      className="relative max-w-xl w-full mx-auto"
      onClick={focusSearch}
    >
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
        <Input
          id="main-search-input"
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search notes"
          className="pl-8 pr-8 h-8 bg-gray-800 border-gray-700 focus-visible:ring-primary focus-visible:ring-offset-gray-900 w-full text-sm"
        />
        {searchTerm && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-0 h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[300px] overflow-y-auto bg-gray-900 border border-gray-700 rounded-md shadow-lg">
          <ul className="py-1">
            {searchResults.map((result) => (
              <li 
                key={result.id}
                className="px-3 py-2 hover:bg-gray-800 cursor-pointer"
                onClick={() => handleSelectResult(result)}
              >
                <p className="text-sm text-gray-300">{result.content}</p>
                {result.path.length > 1 && (
                  <p className="text-xs text-gray-500 truncate">
                    Path: {result.path.slice(0, -1).join(' > ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showResults && searchTerm && searchResults.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg p-3">
          <p className="text-sm text-gray-400">No results found</p>
        </div>
      )}
    </div>
  );
}
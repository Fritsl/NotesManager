import { useState, useEffect } from "react";
import Header from "@/components/HeaderWithSearch";
import NoteTree from "@/components/NoteTree";
import { Button } from "@/components/ui/button";
import { FilePlus, FilterX } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { FilterType } from "@/components/FilterMenu";
import FilteredNotesView from "@/components/FilteredNotesView";
import { Note } from "@/types/notes";

export default function NotesEditor() {
  const isMobile = useIsMobile();
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const { hasActiveProject, currentProjectName, addNote } = useNotes();
  
  // Handle filter change
  const handleFilterChange = (filtered: Note[], type: FilterType) => {
    setFilteredNotes(filtered);
    setActiveFilter(type);
    
    // Update document title when applying a filter
    if (type) {
      document.title = `Filtered Notes - ${currentProjectName || "Notes"}`;
    } else {
      document.title = currentProjectName || "Notes";
    }
  };
  
  // Listen for filter change events from HeaderWithSearch
  useEffect(() => {
    const handleFilterEvent = (event: CustomEvent) => {
      const { filteredNotes, filterType } = event.detail;
      setFilteredNotes(filteredNotes);
      setActiveFilter(filterType);
    };
    
    window.addEventListener('filter-change', handleFilterEvent as EventListener);
    
    return () => {
      window.removeEventListener('filter-change', handleFilterEvent as EventListener);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <Header />
      
      {hasActiveProject ? (
        <div className="flex flex-1 h-[calc(100vh-42px)] overflow-hidden">
          {/* Main content area - full width with no side panel */}
          <div className="w-full bg-gray-950 overflow-auto custom-scrollbar mobile-touch-scrolling">
            {activeFilter ? (
              <FilteredNotesView filteredNotes={filteredNotes} filterType={activeFilter} />
            ) : (
              <NoteTree />
            )}
            
            {activeFilter && filteredNotes.length > 0 && (
              <div className="fixed bottom-4 left-4 z-10">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => handleFilterChange([], null)}
                >
                  <FilterX className="h-4 w-4" />
                  Clear Filter
                </Button>
              </div>
            )}
          </div>
          
          {/* Mobile floating action buttons */}
          {isMobile && (
            <div className="fixed right-4 bottom-4 flex flex-col space-y-2 z-10">
              {/* Clear filter button - only show if filter is active */}
              {activeFilter && filteredNotes.length > 0 && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleFilterChange([], null)}
                  className="rounded-full h-12 w-12 shadow-lg bg-secondary/90 border-secondary-foreground text-secondary-foreground hover:bg-secondary"
                >
                  <FilterX className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1">
          <Button 
            onClick={() => addNote()} 
            variant="ghost" 
            className="text-gray-400 hover:text-gray-100 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add a note
          </Button>
        </div>
      )}
      
      <style>{`
        .tree-line {
          border-left: 1px dashed #4b5563;
          margin-left: 8px;
          padding-left: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from "react";
import Header from "@/components/HeaderWithSearch";
import NoteTree from "@/components/NoteTree";
import NoteEditor from "@/components/NoteEditor";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilePlus, Menu, Edit, FilterX, X } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import FilterMenu, { FilterType } from "@/components/FilterMenu";
import FilteredNotesView from "@/components/FilteredNotesView";
import { Note } from "@/types/notes";

export default function NotesEditor() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const { selectedNote, hasActiveProject, currentProjectName, addNote } = useNotes();

  // Handle note selection on mobile
  useEffect(() => {
    if (isMobile && selectedNote) {
      // Keep the editor open when a note is selected
      setSidebarOpen(true);
    }
  }, [selectedNote, isMobile]);
  
  // Handle filter change
  const handleFilterChange = (filtered: Note[], type: FilterType) => {
    setFilteredNotes(filtered);
    setActiveFilter(type);
    
    // Clear selected note when applying a filter
    if (type) {
      document.title = `Filtered Notes - ${currentProjectName || "Notes"}`;
    } else {
      document.title = currentProjectName || "Notes";
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <Header />
      
      {hasActiveProject ? (
        <div className="flex flex-1 h-[calc(100vh-42px)] overflow-hidden">
          {/* Desktop Layout - Tree Takes Priority */}
          {!isMobile && (
            <>
              {/* Tree View - Now much larger */}
              <div className="w-2/3 xl:w-3/4 border-r border-gray-800 bg-gray-950 overflow-auto custom-scrollbar mobile-touch-scrolling">
                {/* Filter Menu */}
                <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-2">
                  <FilterMenu onFilterChange={handleFilterChange} />
                </div>
                
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
              
              {/* Editor Panel - Now smaller, collapsible */}
              <aside className="w-1/3 xl:w-1/4 bg-gray-950 overflow-auto custom-scrollbar mobile-touch-scrolling transition-all duration-300 ease-in-out">
                <NoteEditor />
              </aside>
            </>
          )}
          
          {/* Mobile Layout */}
          {isMobile && (
            <>
              {/* Main tree view for mobile */}
              <main className="flex-1 flex flex-col bg-gray-950 overflow-auto custom-scrollbar mobile-touch-scrolling">
                {/* Filter Menu */}
                <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-2">
                  <FilterMenu onFilterChange={handleFilterChange} />
                </div>
                
                {activeFilter ? (
                  <FilteredNotesView filteredNotes={filteredNotes} filterType={activeFilter} />
                ) : (
                  <NoteTree />
                )}
              </main>
              
              {/* Mobile floating action buttons */}
              <div className="fixed right-4 bottom-4 flex flex-col space-y-2 z-10">
                {/* Add note button */}
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => addNote(null)}
                  className="rounded-full h-12 w-12 shadow-lg bg-primary/90 border-primary-foreground text-white hover:bg-primary"
                >
                  <FilePlus className="h-5 w-5" />
                </Button>
                
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
                
                {/* Editor button - only show if a note is selected or editor is already open */}
                {(selectedNote || sidebarOpen) && (
                  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="rounded-full h-12 w-12 shadow-lg bg-gray-800 border-gray-700 text-gray-300"
                      >
                        <Edit className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent 
                      side="right" 
                      className="w-[90%] sm:w-[75%] p-0 bg-gray-950 border-l border-gray-800 overflow-auto mobile-touch-scrolling"
                    >
                      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-2 flex justify-between items-center">
                        <h2 className="text-sm font-medium text-gray-200">Edit Note</h2>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSidebarOpen(false)}
                          className="h-8 w-8 p-0 rounded-full"
                        >
                          <span className="sr-only">Close</span>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-0">
                        <NoteEditor />
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 sm:py-12">
          <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-4 sm:p-6 shadow-lg">
            <div className="text-center mb-4 sm:mb-6">
              <FilePlus className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold text-gray-100 mb-1">No Active Project</h2>
              <p className="text-sm sm:text-base text-gray-400">
                Create a new project or import an existing one to begin organizing your notes
              </p>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="border-t border-gray-800 pt-3 sm:pt-4">
                <h3 className="font-medium text-gray-300 mb-2 text-sm sm:text-base">Get Started:</h3>
                <ul className="text-xs sm:text-sm space-y-2">
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5 flex-shrink-0">1</span>
                    <span className="text-gray-300">Click "New" in the menu to create a project</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5 flex-shrink-0">2</span>
                    <span className="text-gray-300">Once created, you can add notes and organize them hierarchically</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5 flex-shrink-0">3</span>
                    <span className="text-gray-300">Or import an existing notes file from the menu to get started</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
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

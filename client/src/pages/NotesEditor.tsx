import { useState, useEffect } from "react";
import Header from "@/components/Header";
import NoteTree from "@/components/NoteTree";
import NoteEditor from "@/components/NoteEditor";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilePlus, Menu, Edit } from "lucide-react";
import { useNotes } from "@/context/NotesContext";
import { useIsMobile } from "@/hooks/use-mobile";

export default function NotesEditor() {
  const { isMobile } = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedNote, hasActiveProject, currentProjectName, addNote } = useNotes();

  // Close sidebar when a note is selected on mobile
  useEffect(() => {
    if (isMobile && selectedNote && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [selectedNote, isMobile, sidebarOpen]);

  // Auto-open editor when a note is selected on mobile
  useEffect(() => {
    if (isMobile && selectedNote && !sidebarOpen) {
      setSidebarOpen(true);
    }
  }, [selectedNote, isMobile]);

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
                <NoteTree />
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
                <NoteTree />
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
                    <SheetContent side="right" className="w-[90%] sm:w-[75%] p-0 bg-gray-950 border-l border-gray-800 overflow-auto mobile-touch-scrolling">
                      <NoteEditor />
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

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import NoteTree from "@/components/NoteTree";
import NoteEditor from "@/components/NoteEditor";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FilePlus, Menu } from "lucide-react";
import { useNotes } from "@/context/NotesContext";

export default function NotesEditor() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedNote, hasActiveProject, currentProjectName } = useNotes();

  // Check if it's a mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    
    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  // Close sidebar when a note is selected on mobile
  useEffect(() => {
    if (isMobile && selectedNote && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [selectedNote, isMobile, sidebarOpen]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <Header />
      
      {hasActiveProject ? (
        <div className="flex flex-1 h-[calc(100vh-42px)] overflow-hidden">
          {/* Desktop Layout - Tree Takes Priority */}
          {!isMobile && (
            <>
              {/* Tree View - Now much larger */}
              <div className="w-2/3 xl:w-3/4 border-r border-gray-800 bg-gray-950 overflow-auto custom-scrollbar">
                <NoteTree />
              </div>
              
              {/* Editor Panel - Now smaller, collapsible */}
              <aside className="w-1/3 xl:w-1/4 bg-gray-950 overflow-auto custom-scrollbar transition-all duration-300 ease-in-out">
                <NoteEditor />
              </aside>
            </>
          )}
          
          {/* Mobile Sidebar */}
          {isMobile && (
            <>
              {/* Main tree view for mobile */}
              <main className="flex-1 flex flex-col bg-gray-950 overflow-auto custom-scrollbar">
                <NoteTree />
              </main>
              
              {/* Sheet/Slide-in editor for mobile */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="fixed right-4 bottom-4 z-10 rounded-full h-12 w-12 shadow-lg bg-gray-800 border-gray-700 text-gray-300"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[90%] p-0 bg-gray-950 border-l border-gray-800">
                  <NoteEditor />
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
          <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-6 shadow-lg">
            <div className="text-center mb-6">
              <FilePlus className="h-12 w-12 mx-auto mb-3 text-primary" />
              <h2 className="text-xl font-bold text-gray-100 mb-1">No Active Project</h2>
              <p className="text-gray-400">
                Create a new project or import an existing one to begin organizing your notes
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="border-t border-gray-800 pt-4">
                <h3 className="font-medium text-gray-300 mb-2">Get Started:</h3>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">1</span>
                    <span className="text-gray-300">Enter a project name in the header above and click "Create Project"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">2</span>
                    <span className="text-gray-300">Once created, you can add notes and organize them hierarchically</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">3</span>
                    <span className="text-gray-300">Or import an existing notes file to get started immediately</span>
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

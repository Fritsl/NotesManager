import { useState, useEffect } from "react";
import Header from "@/components/Header";
import NoteTree from "@/components/NoteTree";
import NoteEditor from "@/components/NoteEditor";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useNotes } from "@/context/NotesContext";

export default function NotesEditor() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedNote } = useNotes();

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

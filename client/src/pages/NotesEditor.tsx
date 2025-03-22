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
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className="w-1/3 lg:w-1/4 border-r border-gray-200 bg-white overflow-auto custom-scrollbar">
            <NoteTree />
          </aside>
        )}
        
        {/* Mobile Sidebar */}
        {isMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute left-4 top-20 z-10"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85%] p-0">
              <NoteTree />
            </SheetContent>
          </Sheet>
        )}
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-gray-50 overflow-auto custom-scrollbar">
          <NoteEditor />
        </main>
      </div>
      
      <style jsx global>{`
        .tree-line {
          border-left: 1px dashed #d1d5db;
          margin-left: 12px;
          padding-left: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}

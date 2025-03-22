import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNotes } from '@/context/NotesContext';
import { Wifi, WifiOff, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function WebSocketStatus() {
  const { isConnected, clientCount, sendMessage } = useWebSocket({
    onMessage: (message) => {
      // Handle incoming messages
      if (message.type === 'noteUpdate') {
        // Handle note updates from other clients
        console.log('Received note update:', message.data);
        // We could apply this update to our local state if needed
      } else if (message.type === 'notesLoaded') {
        console.log('Received notes data from another client');
        // We could sync with this data if needed
      }
    }
  });
  
  const { notes, isLoading } = useNotes();
  
  // Broadcast notes loaded event when notes are loaded
  useEffect(() => {
    if (!isLoading && notes.length > 0 && isConnected) {
      sendMessage({
        type: 'notesLoaded',
        data: { notes }
      });
    }
  }, [isLoading, notes, isConnected, sendMessage]);
  
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className={`flex items-center gap-1 px-2 text-xs ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>WebSocket {isConnected ? 'connected' : 'disconnected'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {isConnected && clientCount > 1 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="flex items-center gap-1 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200">
                <Users className="h-3 w-3" />
                <span>{clientCount}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{clientCount} {clientCount === 1 ? 'user' : 'users'} connected</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
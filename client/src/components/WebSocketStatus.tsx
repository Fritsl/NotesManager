import { useEffect, useRef } from 'react';
import { useSingletonWebSocket, WebSocketMessage } from '@/hooks/use-singleton-websocket';
import { useNotes } from '@/context/NotesContext';
import { Wifi, WifiOff, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function WebSocketStatus() {
  const { isConnected, clientCount, sendMessage } = useSingletonWebSocket({
    onMessage: (message: WebSocketMessage) => {
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
  const hasSentInitialData = useRef(false);
  
  // Broadcast notes loaded event when notes are loaded - but only once when connection is established
  useEffect(() => {
    if (!isLoading && notes.length > 0 && isConnected && !hasSentInitialData.current) {
      // Only send once per session
      const messageData = {
        type: 'notesLoaded',
        data: { notesCount: notes.length } // Just send count to avoid circular references
      };
      console.log('[WebSocketStatus] Connection established, sending initial data');
      sendMessage(messageData);
      hasSentInitialData.current = true;
    }
  }, [isConnected, isLoading, notes, sendMessage]); // Include all dependencies but control with ref
  
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
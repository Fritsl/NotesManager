import { useState, useRef, useEffect, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketProps {
  onMessage?: (message: WebSocketMessage) => void;
}

// Create a singleton WebSocket instance that can be shared across components
let globalWebSocket: WebSocket | null = null;
let globalListeners: Set<(message: WebSocketMessage) => void> = new Set();
let globalConnected = false;
let globalClientCount = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let connectionAttemptInProgress = false;

// Function to establish WebSocket connection
const establishConnection = () => {
  if (globalWebSocket || connectionAttemptInProgress) return;
  
  connectionAttemptInProgress = true;
  
  try {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`[WebSocket] Creating global connection to ${wsUrl}`);
    globalWebSocket = new WebSocket(wsUrl);
    
    globalWebSocket.addEventListener('open', () => {
      console.log('[WebSocket] Connection established successfully');
      globalConnected = true;
      connectionAttemptInProgress = false;
      
      // Clear any reconnection timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Notify all listeners of connection change
      window.dispatchEvent(new CustomEvent('websocket-connection-change', { 
        detail: { connected: true } 
      }));
    });
    
    globalWebSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        
        // Update client count if relevant
        if (message.type === 'clientCount') {
          globalClientCount = message.count;
          window.dispatchEvent(new CustomEvent('websocket-client-count', { 
            detail: { count: message.count } 
          }));
        }
        
        // Distribute message to all registered listeners
        globalListeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('[WebSocket] Error in message listener:', error);
          }
        });
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    });
    
    globalWebSocket.addEventListener('close', (event) => {
      console.log(`[WebSocket] Connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      globalConnected = false;
      globalWebSocket = null;
      connectionAttemptInProgress = false;
      
      // Notify all listeners of connection change
      window.dispatchEvent(new CustomEvent('websocket-connection-change', { 
        detail: { connected: false } 
      }));
      
      // Only attempt to reconnect for abnormal closures
      if (event.code !== 1000 && event.code !== 1001) {
        console.log('[WebSocket] Will attempt to reconnect in 5 seconds');
        reconnectTimeout = setTimeout(() => {
          console.log('[WebSocket] Attempting to reconnect...');
          establishConnection();
        }, 5000);
      }
    });
    
    globalWebSocket.addEventListener('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      // The close handler will handle reconnection
    });
  } catch (error) {
    console.error('[WebSocket] Failed to create connection:', error);
    globalWebSocket = null;
    connectionAttemptInProgress = false;
    
    // Attempt to reconnect after a delay
    reconnectTimeout = setTimeout(() => {
      console.log('[WebSocket] Attempting to reconnect after error...');
      establishConnection();
    }, 5000);
  }
};

// Helper function to send a message through the global WebSocket
const sendGlobalMessage = (message: WebSocketMessage): boolean => {
  if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
    globalWebSocket.send(JSON.stringify(message));
    return true;
  }
  console.warn('[WebSocket] Not connected, message not sent');
  return false;
};

export function useSingletonWebSocket({ onMessage }: UseWebSocketProps = {}) {
  const [isConnected, setIsConnected] = useState<boolean>(globalConnected);
  const [clientCount, setClientCount] = useState<number>(globalClientCount);
  
  // Set up connection and register message listener
  useEffect(() => {
    // Initialize connection if not already established
    if (!globalWebSocket && !connectionAttemptInProgress) {
      establishConnection();
    }
    
    // Register the message listener if provided
    if (onMessage) {
      globalListeners.add(onMessage);
    }
    
    // Listen for connection status changes
    const handleConnectionChange = (event: CustomEvent) => {
      setIsConnected(event.detail.connected);
    };
    
    // Listen for client count updates
    const handleClientCount = (event: CustomEvent) => {
      setClientCount(event.detail.count);
    };
    
    // Add event listeners
    window.addEventListener('websocket-connection-change', handleConnectionChange as EventListener);
    window.addEventListener('websocket-client-count', handleClientCount as EventListener);
    
    // Sync initial state
    setIsConnected(globalConnected);
    setClientCount(globalClientCount);
    
    // Clean up on unmount
    return () => {
      if (onMessage) {
        globalListeners.delete(onMessage);
      }
      
      window.removeEventListener('websocket-connection-change', handleConnectionChange as EventListener);
      window.removeEventListener('websocket-client-count', handleClientCount as EventListener);
    };
  }, [onMessage]);
  
  // Wrap the send function to ensure it uses the global instance
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    return sendGlobalMessage(message);
  }, []);
  
  return {
    isConnected,
    clientCount,
    sendMessage,
  };
}
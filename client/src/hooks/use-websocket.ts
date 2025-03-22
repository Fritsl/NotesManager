import { useState, useEffect, useRef, useCallback } from 'react';

// Define message types
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketProps {
  onMessage?: (message: WebSocketMessage) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Set up the WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (socketRef.current) {
      console.log('WebSocket connection already exists or is in progress');
      return;
    }
    
    try {
      // Create WebSocket connection with the correct path
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      socketRef.current = new WebSocket(wsUrl);
      
      // Connection opened
      socketRef.current.addEventListener('open', () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });
      
      // Listen for messages
      socketRef.current.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // Handle client count updates
          if (message.type === 'clientCount') {
            setClientCount(message.count);
          }
          
          // Pass the message to the provided callback
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Connection closed or error
      socketRef.current.addEventListener('close', (event) => {
        console.log(`WebSocket disconnected with code: ${event.code}, reason: ${event.reason}`);
        setIsConnected(false);
        socketRef.current = null;
        
        // Only try to reconnect for non-normal closures and if not unmounting
        if (event.code !== 1000 && event.code !== 1001) {
          // Try to reconnect after a delay
          console.log('Scheduling reconnection attempt');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connectWebSocket();
          }, 5000); // Longer timeout to avoid rapid reconnection attempts
        }
      });
      
      socketRef.current.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        // Don't close here as the close event will fire afterwards
      });
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      socketRef.current = null;
    }
  }, [onMessage]);
  
  // Send a message through the WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, message not sent');
    return false;
  }, []);
  
  // Set up the WebSocket connection on component mount
  useEffect(() => {
    // Create a flag to track if the component is mounted
    let isMounted = true;
    
    // Only connect if the component is mounted
    if (isMounted) {
      connectWebSocket();
    }
    
    // Clean up on unmount
    return () => {
      isMounted = false;
      
      if (socketRef.current) {
        console.log('Closing WebSocket connection due to component unmount');
        socketRef.current.close(1000, 'Component unmounted');
        socketRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        console.log('Clearing reconnection timeout');
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connectWebSocket]);
  
  return {
    isConnected,
    clientCount,
    sendMessage,
  };
}
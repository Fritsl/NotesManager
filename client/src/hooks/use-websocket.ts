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
    try {
      // Create WebSocket connection with the correct path
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      socketRef.current = new WebSocket(wsUrl);
      
      // Connection opened
      socketRef.current.addEventListener('open', () => {
        console.log('WebSocket connected');
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
      socketRef.current.addEventListener('close', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        socketRef.current = null;
        
        // Try to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connectWebSocket();
        }, 3000);
      });
      
      socketRef.current.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
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
    connectWebSocket();
    
    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);
  
  return {
    isConnected,
    clientCount,
    sendMessage,
  };
}
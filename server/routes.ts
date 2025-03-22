import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./vite";

// Message types for WebSocket communication
interface NoteUpdateMessage {
  type: 'noteUpdate';
  data: any; // The updated note data
}

interface NotesLoadedMessage {
  type: 'notesLoaded';
  data: any; // The full notes data
}

interface ClientCountMessage {
  type: 'clientCount';
  count: number;
}

type WebSocketMessage = NoteUpdateMessage | NotesLoadedMessage | ClientCountMessage;

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server on a specific path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track connected clients
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    log('WebSocket client connected', 'ws');
    clients.add(ws);
    
    // Send client count to all clients
    const clientCountMessage: ClientCountMessage = {
      type: 'clientCount',
      count: clients.size
    };
    broadcastMessage(clientCountMessage);
    
    ws.on('message', (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
        log(`Received message: ${parsedMessage.type}`, 'ws');
        
        // Broadcast the message to all other clients
        broadcastMessage(parsedMessage, ws);
      } catch (error) {
        log(`Error parsing message: ${error}`, 'ws');
      }
    });
    
    ws.on('close', () => {
      log('WebSocket client disconnected', 'ws');
      clients.delete(ws);
      
      // Update client count for remaining clients
      const clientCountMessage: ClientCountMessage = {
        type: 'clientCount',
        count: clients.size
      };
      broadcastMessage(clientCountMessage);
    });
    
    // Send initial ping to confirm connection
    ws.send(JSON.stringify({ type: 'connected', message: 'Successfully connected to WebSocket server' }));
  });
  
  // Helper function to broadcast messages to all clients
  function broadcastMessage(message: WebSocketMessage, excludeClient?: WebSocket) {
    const messageString = JSON.stringify(message);
    clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }

  return httpServer;
}

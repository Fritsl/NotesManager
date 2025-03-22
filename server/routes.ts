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
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Add ping interval to keep connections alive
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Below options specified as default values.
      concurrencyLimit: 10, // Limits zlib concurrency for performance.
      threshold: 1024 // Size (in bytes) below which messages should not be compressed.
    }
  });
  
  // Track connected clients
  const clients = new Set<WebSocket>();
  
  // Heartbeat to keep connections alive and detect stale connections
  function heartbeat(this: WebSocket) {
    (this as any).isAlive = true;
  }
  
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        log('Terminating inactive client', 'ws');
        return ws.terminate();
      }
      
      (ws as any).isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        log(`Error sending ping: ${err}`, 'ws');
      }
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress || 'unknown';
    log(`WebSocket client connected from ${ip}`, 'ws');
    
    (ws as any).isAlive = true;
    ws.on('pong', heartbeat);
    
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
    
    ws.on('close', (code, reason) => {
      log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason}`, 'ws');
      clients.delete(ws);
      
      // Update client count for remaining clients
      const clientCountMessage: ClientCountMessage = {
        type: 'clientCount',
        count: clients.size
      };
      broadcastMessage(clientCountMessage);
    });
    
    ws.on('error', (error) => {
      log(`WebSocket error: ${error.message}`, 'ws');
    });
    
    // Send initial ping to confirm connection
    try {
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'Successfully connected to WebSocket server',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      log(`Error sending initial message: ${error}`, 'ws');
    }
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

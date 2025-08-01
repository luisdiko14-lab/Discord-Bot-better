const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

// Import our routes
const routes = require('./server/routes');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API routes
app.use(routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Keep-alive endpoint for bot pinging
app.post('/ping', (req, res) => {
  console.log('Keep-alive ping received at', new Date().toISOString());
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString() 
  });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Discord Bot Dashboard',
    timestamp: new Date().toISOString()
  }));

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data);
      
      // Echo back for now - in real implementation, this would handle bot commands
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'response',
          originalMessage: data,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast function for real-time updates
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
      }));
    }
  });
}

// Keep-alive functionality
setInterval(() => {
  console.log(`Bot Dashboard is alive - ${new Date().toISOString()}`);
  
  // Broadcast heartbeat to connected clients
  broadcast({
    type: 'heartbeat',
    message: 'Dashboard is alive'
  });
}, 30000); // Every 30 seconds

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Discord Bot Dashboard running on port ${port}`);
  console.log(`🌐 HTTP: http://0.0.0.0:${port}`);
  console.log(`🔌 WebSocket: ws://0.0.0.0:${port}/ws`);
  console.log(`💓 Keep-alive enabled with 30s heartbeat`);
});

module.exports = { app, server, broadcast };
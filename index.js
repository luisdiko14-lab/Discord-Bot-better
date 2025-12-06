const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple in-memory storage for demo
let bots = [
  {
    id: 1,
    name: "Demo Bot",
    clientId: "123456789012345678",
    token: "demo_token_replace_with_real",
    prefix: "!",
    status: "online",
    keepAlive: true,
    lastPing: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let servers = [
  {
    id: 1,
    guildId: "1370394626476867696",
    name: "Demo Server",
    botId: 1,
    isActive: true,
    settings: {
      moderationEnabled: true,
      musicEnabled: true,
      antiNukeEnabled: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let activityLogs = [
  {
    id: 1,
    botId: 1,
    serverId: 1,
    action: "Bot Started",
    userId: null,
    details: { message: "Demo bot initialized" },
    timestamp: new Date().toISOString()
  }
];

// API Routes
app.get('/api/bots', (req, res) => {
  res.json(bots);
});

app.get('/api/bots/:id', (req, res) => {
  const bot = bots.find(b => b.id == req.params.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  res.json(bot);
});

app.post('/api/bots', (req, res) => {
  const newBot = {
    id: bots.length + 1,
    ...req.body,
    status: 'offline',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  bots.push(newBot);
  
  // Add activity log
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: newBot.id,
    serverId: null,
    action: "Bot Created",
    userId: null,
    details: { name: newBot.name },
    timestamp: new Date().toISOString()
  });
  
  res.status(201).json(newBot);
});

app.patch('/api/bots/:id', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots[botIndex] = {
    ...bots[botIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  res.json(bots[botIndex]);
});

app.delete('/api/bots/:id', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots.splice(botIndex, 1);
  res.status(204).send();
});

app.post('/api/bots/:id/ping', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots[botIndex].status = req.body.status || 'online';
  bots[botIndex].lastPing = new Date().toISOString();
  bots[botIndex].updatedAt = new Date().toISOString();
  
  // Add activity log
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: bots[botIndex].id,
    serverId: null,
    action: "Bot Pinged",
    userId: null,
    details: { status: bots[botIndex].status },
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true });
});

app.get('/api/servers', (req, res) => {
  const botId = req.query.botId;
  const guildId = req.query.guildId;
  
  let filteredServers = servers;
  
  if (botId) {
    filteredServers = filteredServers.filter(s => s.botId == botId);
  }
  
  if (guildId) {
    filteredServers = filteredServers.filter(s => s.guildId === guildId);
  }
  
  res.json(filteredServers);
});

app.get('/api/servers/:id', (req, res) => {
  const server = servers.find(s => s.id == req.params.id);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json(server);
});

app.post('/api/servers', (req, res) => {
  const newServer = {
    id: servers.length + 1,
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  servers.push(newServer);
  res.status(201).json(newServer);
});

app.get('/api/servers/:serverId/moderation', (req, res) => {
  // Return default moderation commands for demo
  res.json([
    {
      id: 1,
      serverId: parseInt(req.params.serverId),
      command: "ban",
      isEnabled: true,
      requiredPermission: "BAN_MEMBERS",
      requiredRoles: [],
      cooldownSeconds: 0,
      settings: { logAction: true, dmUser: true }
    },
    {
      id: 2,
      serverId: parseInt(req.params.serverId),
      command: "kick",
      isEnabled: true,
      requiredPermission: "KICK_MEMBERS",
      requiredRoles: [],
      cooldownSeconds: 0,
      settings: { logAction: true, dmUser: true }
    }
  ]);
});

app.get('/api/servers/:serverId/music', (req, res) => {
  // Return default music config for demo
  res.json({
    id: 1,
    serverId: parseInt(req.params.serverId),
    youtubeEnabled: true,
    spotifyEnabled: true,
    maxQueueSize: 100,
    maxTrackDuration: 3600,
    volume: 50,
    settings: {
      autoLeave: true,
      autoLeaveTimeout: 300,
      loopMode: 'off',
      shuffleEnabled: false
    }
  });
});

app.get('/api/servers/:serverId/antinuke', (req, res) => {
  // Return default anti-nuke config for demo
  res.json({
    id: 1,
    serverId: parseInt(req.params.serverId),
    isEnabled: true,
    protectionLevel: 'medium',
    whitelistedUsers: [],
    whitelistedRoles: [],
    triggers: {
      channelDelete: { enabled: true, limit: 3, timeframe: 60 },
      channelCreate: { enabled: true, limit: 5, timeframe: 60 },
      roleDelete: { enabled: true, limit: 3, timeframe: 60 },
      roleCreate: { enabled: true, limit: 5, timeframe: 60 },
      memberBan: { enabled: true, limit: 5, timeframe: 60 },
      memberKick: { enabled: true, limit: 10, timeframe: 60 },
      webhookCreate: { enabled: true, limit: 2, timeframe: 60 },
      botAdd: { enabled: true, limit: 1, timeframe: 300 }
    },
    actions: {
      removePermissions: true,
      banUser: true,
      kickUser: false,
      removeRoles: true,
      lockdown: true,
      notifyOwner: true
    }
  });
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const botId = req.query.botId;
  const serverId = req.query.serverId;
  
  let filteredLogs = activityLogs;
  
  if (botId) {
    filteredLogs = filteredLogs.filter(log => log.botId == botId);
  }
  
  if (serverId) {
    filteredLogs = filteredLogs.filter(log => log.serverId == serverId);
  }
  
  res.json(filteredLogs.slice(0, limit));
});

app.post('/api/logs', (req, res) => {
  const newLog = {
    id: activityLogs.length + 1,
    ...req.body,
    timestamp: req.body.timestamp || new Date().toISOString()
  };
  
  activityLogs.push(newLog);
  res.status(201).json(newLog);
});

// Bot configuration endpoints
app.patch('/api/bots/:id', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots[botIndex] = {
    ...bots[botIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  // Add activity log for configuration change
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: bots[botIndex].id,
    serverId: null,
    action: "Bot Configuration Updated",
    userId: null,
    details: { changes: Object.keys(req.body) },
    timestamp: new Date().toISOString()
  });
  
  res.json(bots[botIndex]);
});

// Bot control endpoints
app.post('/api/bots/:id/start', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots[botIndex].status = 'online';
  bots[botIndex].lastPing = new Date().toISOString();
  bots[botIndex].updatedAt = new Date().toISOString();
  
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: bots[botIndex].id,
    serverId: null,
    action: "Bot Started",
    userId: null,
    details: { status: 'online' },
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true, status: 'Bot started successfully' });
});

app.post('/api/bots/:id/stop', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots[botIndex].status = 'offline';
  bots[botIndex].updatedAt = new Date().toISOString();
  
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: bots[botIndex].id,
    serverId: null,
    action: "Bot Stopped",
    userId: null,
    details: { status: 'offline' },
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true, status: 'Bot stopped successfully' });
});

app.post('/api/bots/:id/restart', (req, res) => {
  const botIndex = bots.findIndex(b => b.id == req.params.id);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  bots[botIndex].status = 'online';
  bots[botIndex].lastPing = new Date().toISOString();
  bots[botIndex].updatedAt = new Date().toISOString();
  
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: bots[botIndex].id,
    serverId: null,
    action: "Bot Restarted",
    userId: null,
    details: { status: 'restarted' },
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true, status: 'Bot restarted successfully' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// System Info endpoint - simulated hardware specs
app.get('/api/system-info', (req, res) => {
  const uptime = process.uptime();
  const baseRamUsage = 528;
  const ramVariation = Math.sin(Date.now() / 10000) * 30;
  const ramUsed = Math.max(80, Math.min(280, baseRamUsage + ramVariation + Math.random() * 50));
  
  const baseCpuUsage = 120;
  const cpuVariation = Math.sin(Date.now() / 12000) * 8;
  const cpuUsage = Math.max(5, Math.min(45, baseCpuUsage + cpuVariation + Math.random() * 10));
  
  res.json({
    cpu: {
      model: "AMD Ryzen 7 7800X3D",
      cores: 126,
      usage: parseFloat(cpuUsage.toFixed(1)),
      temperature: parseFloat((45 + Math.random() * 15).toFixed(1))
    },
    ram: {
      total: 528,
      used: parseFloat(ramUsed.toFixed(2)),
      free: parseFloat((528 - ramUsed).toFixed(2)),
      usagePercent: parseFloat(((ramUsed / 528) * 100).toFixed(1))
    },
    uptime: {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime)
    },
    status: 'healthy'
  });
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Delete server endpoint
app.delete('/api/servers/:id', (req, res) => {
  const serverIndex = servers.findIndex(s => s.id == req.params.id);
  if (serverIndex === -1) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  const deletedServer = servers[serverIndex];
  servers.splice(serverIndex, 1);
  
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: deletedServer.botId,
    serverId: null,
    action: "Server Removed",
    userId: null,
    details: { name: deletedServer.name },
    timestamp: new Date().toISOString()
  });
  
  res.status(204).send();
});

// Update server endpoint
app.patch('/api/servers/:id', (req, res) => {
  const serverIndex = servers.findIndex(s => s.id == req.params.id);
  if (serverIndex === -1) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  servers[serverIndex] = {
    ...servers[serverIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: servers[serverIndex].botId,
    serverId: servers[serverIndex].id,
    action: "Server Updated",
    userId: null,
    details: { name: servers[serverIndex].name, changes: Object.keys(req.body) },
    timestamp: new Date().toISOString()
  });
  
  res.json(servers[serverIndex]);
});

// Keep-alive endpoint for bot pinging
app.post('/ping', (req, res) => {
  console.log('Keep-alive ping received at', new Date().toISOString());
  
  // Add activity log
  activityLogs.push({
    id: activityLogs.length + 1,
    botId: 1, // Demo bot
    serverId: null,
    action: "Keep-Alive Ping",
    userId: null,
    details: { source: req.body.source || 'unknown' },
    timestamp: new Date().toISOString()
  });
  
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
  
  // Update bot status randomly for demo
  if (bots.length > 0) {
    const randomBot = bots[Math.floor(Math.random() * bots.length)];
    const statuses = ['online', 'idle', 'busy'];
    randomBot.status = statuses[Math.floor(Math.random() * statuses.length)];
    randomBot.lastPing = new Date().toISOString();
  }
  
  // Broadcast heartbeat to connected clients
  broadcast({
    type: 'heartbeat',
    message: 'Dashboard is alive',
    bots: bots.length,
    servers: servers.length
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
  console.log(`📊 Dashboard initialized with ${bots.length} bots and ${servers.length} servers`);
});

module.exports = { app, server, broadcast };
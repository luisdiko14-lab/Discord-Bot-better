const express = require("express");
const { storage } = require("./storage");
const {
  insertBotSchema,
  insertServerSchema,
  insertModerationCommandSchema,
  insertMusicConfigSchema,
  insertAntiNukeConfigSchema,
  insertCustomCommandSchema,
} = require("../shared/schema");

const router = express.Router();

// Bot routes
router.get("/api/bots", async (req, res) => {
  try {
    const bots = await storage.getBots();
    res.json(bots);
  } catch (error) {
    console.error("Error fetching bots:", error);
    res.status(500).json({ error: "Failed to fetch bots" });
  }
});

router.get("/api/bots/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const bot = await storage.getBot(id);
    if (!bot) {
      return res.status(404).json({ error: "Bot not found" });
    }
    res.json(bot);
  } catch (error) {
    console.error("Error fetching bot:", error);
    res.status(500).json({ error: "Failed to fetch bot" });
  }
});

router.post("/api/bots", async (req, res) => {
  try {
    const botData = insertBotSchema.parse(req.body);
    const bot = await storage.createBot(botData);
    res.status(201).json(bot);
  } catch (error) {
    console.error("Error creating bot:", error);
    res.status(400).json({ error: "Failed to create bot" });
  }
});

router.patch("/api/bots/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const botData = insertBotSchema.partial().parse(req.body);
    const bot = await storage.updateBot(id, botData);
    res.json(bot);
  } catch (error) {
    console.error("Error updating bot:", error);
    res.status(400).json({ error: "Failed to update bot" });
  }
});

router.delete("/api/bots/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteBot(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting bot:", error);
    res.status(500).json({ error: "Failed to delete bot" });
  }
});

router.post("/api/bots/:id/ping", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status = "online" } = req.body;
    await storage.updateBotStatus(id, status, new Date());
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating bot status:", error);
    res.status(500).json({ error: "Failed to update bot status" });
  }
});

// Server routes
router.get("/api/servers", async (req, res) => {
  try {
    const botId = req.query.botId ? parseInt(req.query.botId as string) : undefined;
    const servers = botId 
      ? await storage.getServersByBot(botId)
      : await storage.getServers();
    res.json(servers);
  } catch (error) {
    console.error("Error fetching servers:", error);
    res.status(500).json({ error: "Failed to fetch servers" });
  }
});

router.get("/api/servers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const server = await storage.getServer(id);
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }
    res.json(server);
  } catch (error) {
    console.error("Error fetching server:", error);
    res.status(500).json({ error: "Failed to fetch server" });
  }
});

router.post("/api/servers", async (req, res) => {
  try {
    const serverData = insertServerSchema.parse(req.body);
    const server = await storage.createServer(serverData);
    res.status(201).json(server);
  } catch (error) {
    console.error("Error creating server:", error);
    res.status(400).json({ error: "Failed to create server" });
  }
});

router.patch("/api/servers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const serverData = insertServerSchema.partial().parse(req.body);
    const server = await storage.updateServer(id, serverData);
    res.json(server);
  } catch (error) {
    console.error("Error updating server:", error);
    res.status(400).json({ error: "Failed to update server" });
  }
});

// Moderation commands routes
router.get("/api/servers/:serverId/moderation", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const commands = await storage.getModerationCommands(serverId);
    res.json(commands);
  } catch (error) {
    console.error("Error fetching moderation commands:", error);
    res.status(500).json({ error: "Failed to fetch moderation commands" });
  }
});

router.post("/api/servers/:serverId/moderation", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const commandData = insertModerationCommandSchema.parse({
      ...req.body,
      serverId,
    });
    const command = await storage.createModerationCommand(commandData);
    res.status(201).json(command);
  } catch (error) {
    console.error("Error creating moderation command:", error);
    res.status(400).json({ error: "Failed to create moderation command" });
  }
});

router.patch("/api/moderation/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const commandData = insertModerationCommandSchema.partial().parse(req.body);
    const command = await storage.updateModerationCommand(id, commandData);
    res.json(command);
  } catch (error) {
    console.error("Error updating moderation command:", error);
    res.status(400).json({ error: "Failed to update moderation command" });
  }
});

// Music configuration routes
router.get("/api/servers/:serverId/music", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const config = await storage.getMusicConfig(serverId);
    res.json(config);
  } catch (error) {
    console.error("Error fetching music config:", error);
    res.status(500).json({ error: "Failed to fetch music config" });
  }
});

router.post("/api/servers/:serverId/music", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const configData = insertMusicConfigSchema.parse({
      ...req.body,
      serverId,
    });
    const config = await storage.createMusicConfig(configData);
    res.status(201).json(config);
  } catch (error) {
    console.error("Error creating music config:", error);
    res.status(400).json({ error: "Failed to create music config" });
  }
});

router.patch("/api/music/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const configData = insertMusicConfigSchema.partial().parse(req.body);
    const config = await storage.updateMusicConfig(id, configData);
    res.json(config);
  } catch (error) {
    console.error("Error updating music config:", error);
    res.status(400).json({ error: "Failed to update music config" });
  }
});

// Anti-nuke configuration routes
router.get("/api/servers/:serverId/antinuke", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const config = await storage.getAntiNukeConfig(serverId);
    res.json(config);
  } catch (error) {
    console.error("Error fetching anti-nuke config:", error);
    res.status(500).json({ error: "Failed to fetch anti-nuke config" });
  }
});

router.post("/api/servers/:serverId/antinuke", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const configData = insertAntiNukeConfigSchema.parse({
      ...req.body,
      serverId,
    });
    const config = await storage.createAntiNukeConfig(configData);
    res.status(201).json(config);
  } catch (error) {
    console.error("Error creating anti-nuke config:", error);
    res.status(400).json({ error: "Failed to create anti-nuke config" });
  }
});

router.patch("/api/antinuke/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const configData = insertAntiNukeConfigSchema.partial().parse(req.body);
    const config = await storage.updateAntiNukeConfig(id, configData);
    res.json(config);
  } catch (error) {
    console.error("Error updating anti-nuke config:", error);
    res.status(400).json({ error: "Failed to update anti-nuke config" });
  }
});

// Custom commands routes
router.get("/api/servers/:serverId/commands", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const commands = await storage.getCustomCommands(serverId);
    res.json(commands);
  } catch (error) {
    console.error("Error fetching custom commands:", error);
    res.status(500).json({ error: "Failed to fetch custom commands" });
  }
});

router.post("/api/servers/:serverId/commands", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const commandData = insertCustomCommandSchema.parse({
      ...req.body,
      serverId,
    });
    const command = await storage.createCustomCommand(commandData);
    res.status(201).json(command);
  } catch (error) {
    console.error("Error creating custom command:", error);
    res.status(400).json({ error: "Failed to create custom command" });
  }
});

router.patch("/api/commands/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const commandData = insertCustomCommandSchema.partial().parse(req.body);
    const command = await storage.updateCustomCommand(id, commandData);
    res.json(command);
  } catch (error) {
    console.error("Error updating custom command:", error);
    res.status(400).json({ error: "Failed to update custom command" });
  }
});

// Activity logs routes
router.get("/api/logs", async (req, res) => {
  try {
    const botId = req.query.botId ? parseInt(req.query.botId as string) : undefined;
    const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    const logs = await storage.getActivityLogs(botId, serverId, limit);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

module.exports = router;
// index.js
// npm i discord.js express

const express = require('express');
const {
  Client,
  Collection,
  GatewayIntentBits,
  ActivityType,
  SlashCommandBuilder,
  REST,
  Routes,
} = require('discord.js');

class DiscordBot {
  constructor(token, clientId) {
    this.token = token;
    this.clientId = clientId; // Discord application/client ID
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commands = new Collection();
    this.cooldowns = new Map();
    this.antiNukeCommands = {
      configs: new Map(),
      loadConfig: (guildId, config) => this.antiNukeCommands.configs.set(guildId, config),
      unloadConfig: (guildId) => this.antiNukeCommands.configs.delete(guildId),
    };

    this.app = express();
    this.app.use(express.json());

    this.port = null;
    this.baseUrl = null;
    this.server = null;
    this.keepAliveInterval = null;
    this.startTime = null;

    this.memory = {
      servers: [],
      moderation: new Map(),
      music: new Map(),
      antinuke: new Map(),
      logs: [],
      botPings: [],
    };

    this.setupApiRoutes();
    this.registerCommands();
    this.setupEventHandlers();

    console.log('📋 Discord Bot Management Dashboard initialized');
    console.log('🔧 Fixed version loaded');
  }

  setupApiRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        ok: true,
        port: this.port,
        uptime: process.uptime(),
        botReady: this.client.isReady?.() ? true : false,
      });
    });

    this.app.get('/api/servers', (req, res) => {
      const { guildId } = req.query;

      if (!guildId) {
        return res.json(this.memory.servers);
      }

      let server = this.memory.servers.find((s) => s.guildId === guildId);
      if (!server) {
        server = {
          id: guildId,
          guildId,
          moderation: [],
          music: {
            isEnabled: true,
            volume: 50,
          },
          antinuke: {
            isEnabled: true,
            requiredRoles: [],
            cooldownSeconds: 0,
          },
        };
        this.memory.servers.push(server);
      }

      res.json([server]);
    });

    this.app.get('/api/servers/:serverId/moderation', (req, res) => {
      const { serverId } = req.params;
      const configs =
        this.memory.moderation.get(serverId) || [
          { command: 'ban', isEnabled: true, requiredRoles: [], cooldownSeconds: 0 },
          { command: 'kick', isEnabled: true, requiredRoles: [], cooldownSeconds: 0 },
          { command: 'mute', isEnabled: true, requiredRoles: [], cooldownSeconds: 0 },
          { command: 'unmute', isEnabled: true, requiredRoles: [], cooldownSeconds: 0 },
        ];

      this.memory.moderation.set(serverId, configs);
      res.json(configs);
    });

    this.app.get('/api/servers/:serverId/music', (req, res) => {
      const { serverId } = req.params;
      const config =
        this.memory.music.get(serverId) || {
          isEnabled: true,
          requiredRoles: [],
          cooldownSeconds: 0,
          volume: 50,
        };

      this.memory.music.set(serverId, config);
      res.json(config);
    });

    this.app.get('/api/servers/:serverId/antinuke', (req, res) => {
      const { serverId } = req.params;
      const config =
        this.memory.antinuke.get(serverId) || {
          isEnabled: true,
          requiredRoles: [],
          cooldownSeconds: 0,
        };

      this.memory.antinuke.set(serverId, config);
      res.json(config);
    });

    this.app.post('/api/logs', (req, res) => {
      this.memory.logs.push({
        ...req.body,
        receivedAt: new Date().toISOString(),
      });
      res.json({ ok: true });
    });

    this.app.post('/api/bots/:botId/ping', (req, res) => {
      this.memory.botPings.push({
        botId: req.params.botId,
        ...req.body,
        receivedAt: new Date().toISOString(),
      });
      res.json({ ok: true });
    });
  }

  registerCommands() {
    const defs = [
      new SlashCommandBuilder().setName('ping').setDescription('Show bot latency'),
      new SlashCommandBuilder().setName('stats').setDescription('Show bot stats'),
      new SlashCommandBuilder().setName('ban').setDescription('Ban a member'),
      new SlashCommandBuilder().setName('kick').setDescription('Kick a member'),
      new SlashCommandBuilder().setName('mute').setDescription('Timeout a member'),
      new SlashCommandBuilder().setName('unmute').setDescription('Remove timeout from a member'),
      new SlashCommandBuilder().setName('play').setDescription('Play music from YouTube'),
      new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear queue'),
      new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
      new SlashCommandBuilder().setName('queue').setDescription('Show the music queue'),
      new SlashCommandBuilder().setName('volume').setDescription('Set music volume'),
      new SlashCommandBuilder().setName('antinuke-status').setDescription('Check anti-nuke protection status'),
    ];

    for (const data of defs) {
      this.commands.set(data.name, {
        data,
        execute: async (interaction, config) => {
          await this.executeCommand(interaction, config);
        },
      });
    }
  }

  setupEventHandlers() {
    this.client.once('ready', async () => {
      console.log(`✅ Logged in as ${this.client.user.tag}`);
      this.client.user.setActivity('Managing servers', {
        type: ActivityType.Watching,
      });

      this.startTime = Date.now();
      await this.updateBotStatus('online');
      console.log(`🌐 Web API running at ${this.baseUrl}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({
          content: 'Unknown command.',
          ephemeral: true,
        }).catch(() => {});
      }

      try {
        const config = await this.getCommandConfig(interaction.guildId, interaction.commandName);

        if (!(await this.checkPermissions(interaction, config))) return;

        await command.execute(interaction, config);

        await this.logActivity(interaction.guildId, {
          action: `Command: ${interaction.commandName}`,
          userId: interaction.user.id,
          details: {
            command: interaction.commandName,
            options: interaction.options?.data || [],
            channel: interaction.channel?.name || null,
          },
        });
      } catch (error) {
        console.error('Command execution error:', error);

        const errorMessage = {
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch {}
      }
    });

    this.client.on('guildCreate', async (guild) => {
      console.log(`✅ Bot added to new guild: ${guild.name} (${guild.id})`);
      await this.logActivity(guild.id, {
        action: 'Bot Added to Server',
        userId: null,
        details: {
          serverName: guild.name,
          memberCount: guild.memberCount,
        },
      });
    });

    this.client.on('guildDelete', async (guild) => {
      console.log(`❌ Bot removed from guild: ${guild.name} (${guild.id})`);
      this.antiNukeCommands.unloadConfig(guild.id);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      console.warn('Discord client warning:', warning);
    });
  }

  async executeCommand(interaction, config) {
    const name = interaction.commandName;

    if (name === 'ping') {
      return interaction.reply({
        content: `Pong! ${this.client.ws.ping}ms`,
        ephemeral: true,
      });
    }

    if (name === 'stats') {
      const status = this.getStatus();
      return interaction.reply({
        content:
          `Status: ${status.status}\n` +
          `Guilds: ${status.guilds}\n` +
          `Users: ${status.users}\n` +
          `Uptime: ${Math.floor((status.uptime || 0) / 1000)}s\n` +
          `Ping: ${status.ping}ms`,
        ephemeral: true,
      });
    }

    if (name === 'antinuke-status') {
      const anti = this.antiNukeCommands.configs.get(interaction.guildId) || config || {};
      return interaction.reply({
        content: `Anti-nuke status: ${anti.isEnabled === false ? 'disabled' : 'enabled'}`,
        ephemeral: true,
      });
    }

    if (['ban', 'kick', 'mute', 'unmute', 'play', 'stop', 'skip', 'queue', 'volume'].includes(name)) {
      return interaction.reply({
        content: `\`${name}\` is wired correctly, but the action logic is still a placeholder in this file.`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: 'Command handled.',
      ephemeral: true,
    });
  }

  async getCommandConfig(guildId, commandName) {
    try {
      const serverResponse = await fetch(`${this.baseUrl}/api/servers?guildId=${encodeURIComponent(guildId)}`);
      let serverId = null;

      if (serverResponse.ok) {
        const servers = await serverResponse.json();
        const server = servers.find((s) => s.guildId === guildId);
        if (server) serverId = server.id;
      }

      if (!serverId) {
        console.log(`No server configuration found for guild ${guildId}`);
        return null;
      }

      if (['ban', 'kick', 'mute', 'unmute'].includes(commandName)) {
        const response = await fetch(`${this.baseUrl}/api/servers/${encodeURIComponent(serverId)}/moderation`);
        if (response.ok) {
          const moderationConfigs = await response.json();
          const config = moderationConfigs.find((cmd) => cmd.command === commandName);
          if (config) return config;
        }
      }

      if (['play', 'stop', 'skip', 'queue', 'volume'].includes(commandName)) {
        const musicResponse = await fetch(`${this.baseUrl}/api/servers/${encodeURIComponent(serverId)}/music`);
        if (musicResponse.ok) return await musicResponse.json();
      }

      if (commandName.startsWith('antinuke')) {
        const antiNukeResponse = await fetch(`${this.baseUrl}/api/servers/${encodeURIComponent(serverId)}/antinuke`);
        if (antiNukeResponse.ok) {
          const config = await antiNukeResponse.json();
          this.antiNukeCommands.loadConfig(guildId, config);
          return config;
        }
      }
    } catch (error) {
      console.error('Error fetching command config:', error);
    }

    return null;
  }

  async checkPermissions(interaction, config) {
    if (!config) return true;

    if (config.isEnabled === false) {
      await interaction.reply({
        content: 'This command is disabled on this server.',
        ephemeral: true,
      });
      return false;
    }

    if (config.requiredRoles && config.requiredRoles.length > 0) {
      const memberRoles = interaction.member?.roles?.cache;
      const hasRole = memberRoles
        ? config.requiredRoles.some((roleId) => memberRoles.has(roleId))
        : false;

      if (!hasRole) {
        await interaction.reply({
          content: 'You do not have the required role to use this command.',
          ephemeral: true,
        });
        return false;
      }
    }

    if (config.cooldownSeconds && config.cooldownSeconds > 0) {
      const cooldownKey = `${interaction.guildId}-${interaction.user.id}-${interaction.commandName}`;
      const lastUsed = this.cooldowns.get(cooldownKey);

      if (lastUsed) {
        const timePassed = Date.now() - lastUsed;
        const cooldownMs = config.cooldownSeconds * 1000;

        if (timePassed < cooldownMs) {
          const timeLeft = Math.ceil((cooldownMs - timePassed) / 1000);
          await interaction.reply({
            content: `Command is on cooldown. Please wait ${timeLeft} seconds.`,
            ephemeral: true,
          });
          return false;
        }
      }

      this.cooldowns.set(cooldownKey, Date.now());
    }

    return true;
  }

  async logActivity(guildId, activity) {
    try {
      await fetch(`${this.baseUrl}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: this.clientId,
          serverId: guildId,
          ...activity,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  async updateBotStatus(status) {
    try {
      await fetch(`${this.baseUrl}/api/bots/1/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          source: 'discord-bot',
        }),
      });
    } catch (error) {
      console.error('Error updating bot status:', error);
    }
  }

  async deployCommands() {
    const rest = new REST({ version: '10' }).setToken(this.token);

    try {
      console.log('🔄 Refreshing application (/) commands...');

      const commandData = Array.from(this.commands.values()).map((command) => command.data.toJSON());

      await rest.put(
        Routes.applicationCommands(this.clientId),
        { body: commandData }
      );

      console.log(`✅ Successfully reloaded ${commandData.length} application (/) commands.`);
    } catch (error) {
      console.error('Error deploying commands:', error);
    }
  }

  async startWebServer() {
    const portsToTry = [3000, 5001, 3001];

    for (const port of portsToTry) {
      try {
        await new Promise((resolve, reject) => {
          const server = this.app.listen(port, '0.0.0.0', () => {
            this.server = server;
            this.port = port;
            this.baseUrl = `http://127.0.0.1:${port}`;
            resolve();
          });

          server.on('error', (err) => {
            server.close(() => reject(err));
          });
        });

        console.log(`✅ Web server started on port ${port}`);
        return port;
      } catch (error) {
        if (error.code === 'EADDRINUSE') {
          console.warn(`⚠️ Port ${port} is busy, trying next...`);
          continue;
        }
        throw error;
      }
    }

    throw new Error('No available port found. Tried 3000, 5001, and 3001.');
  }

  async start() {
    try {
      await this.startWebServer();
      await this.deployCommands();
      await this.client.login(this.token);

      this.keepAliveInterval = setInterval(() => {
        if (this.client.user) {
          this.updateBotStatus(this.client.user.presence?.status || 'online');
        }
      }, 30000);
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.updateBotStatus('offline');
    } catch {}

    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.client) this.client.destroy();
    if (this.server) this.server.close();

    console.log('🛑 Discord bot stopped');
  }

  getStatus() {
    if (!this.client || !this.client.user) {
      return { status: 'offline', guilds: 0, users: 0, uptime: 0, ping: 0 };
    }

    return {
      status: 'online',
      guilds: this.client.guilds.cache.size,
      users: this.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
      uptime: this.client.uptime || 0,
      ping: this.client.ws.ping,
    };
  }
}

module.exports = DiscordBot;

// Example start:
// const bot = new DiscordBot(process.env.BOT_TOKEN, process.env.CLIENT_ID);
// bot.start();
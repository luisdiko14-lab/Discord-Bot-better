const { db } = require("./db");
const { eq, desc } = require("drizzle-orm");
const {
  bots,
  servers,
  moderationCommands,
  musicConfig,
  antiNukeConfig,  
  customCommands,
  activityLogs,
} = require("../shared/schema");

export interface IStorage {
  // Bot management
  getBots(): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
  updateBot(id: number, bot: Partial<InsertBot>): Promise<Bot>;
  deleteBot(id: number): Promise<void>;
  updateBotStatus(id: number, status: string, lastPing?: Date): Promise<void>;

  // Server management
  getServers(): Promise<Server[]>;
  getServersByBot(botId: number): Promise<Server[]>;
  getServer(id: number): Promise<Server | undefined>;
  getServerByGuildId(guildId: string): Promise<Server | undefined>;
  createServer(server: InsertServer): Promise<Server>;
  updateServer(id: number, server: Partial<InsertServer>): Promise<Server>;
  deleteServer(id: number): Promise<void>;

  // Moderation commands
  getModerationCommands(serverId: number): Promise<ModerationCommand[]>;
  createModerationCommand(command: InsertModerationCommand): Promise<ModerationCommand>;
  updateModerationCommand(id: number, command: Partial<InsertModerationCommand>): Promise<ModerationCommand>;
  deleteModerationCommand(id: number): Promise<void>;

  // Music configuration
  getMusicConfig(serverId: number): Promise<MusicConfig | undefined>;
  createMusicConfig(config: InsertMusicConfig): Promise<MusicConfig>;
  updateMusicConfig(id: number, config: Partial<InsertMusicConfig>): Promise<MusicConfig>;

  // Anti-nuke configuration
  getAntiNukeConfig(serverId: number): Promise<AntiNukeConfig | undefined>;
  createAntiNukeConfig(config: InsertAntiNukeConfig): Promise<AntiNukeConfig>;
  updateAntiNukeConfig(id: number, config: Partial<InsertAntiNukeConfig>): Promise<AntiNukeConfig>;

  // Custom commands
  getCustomCommands(serverId: number): Promise<CustomCommand[]>;
  createCustomCommand(command: InsertCustomCommand): Promise<CustomCommand>;
  updateCustomCommand(id: number, command: Partial<InsertCustomCommand>): Promise<CustomCommand>;
  deleteCustomCommand(id: number): Promise<void>;

  // Activity logs
  getActivityLogs(botId?: number, serverId?: number, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
}

export class DatabaseStorage implements IStorage {
  async getBots(): Promise<Bot[]> {
    return await db.select().from(bots).orderBy(desc(bots.createdAt));
  }

  async getBot(id: number): Promise<Bot | undefined> {
    const [bot] = await db.select().from(bots).where(eq(bots.id, id));
    return bot || undefined;
  }

  async createBot(bot: InsertBot): Promise<Bot> {
    const [newBot] = await db.insert(bots).values(bot).returning();
    return newBot;
  }

  async updateBot(id: number, bot: Partial<InsertBot>): Promise<Bot> {
    const [updatedBot] = await db
      .update(bots)
      .set({ ...bot, updatedAt: new Date() })
      .where(eq(bots.id, id))
      .returning();
    return updatedBot;
  }

  async deleteBot(id: number): Promise<void> {
    await db.delete(bots).where(eq(bots.id, id));
  }

  async updateBotStatus(id: number, status: string, lastPing?: Date): Promise<void> {
    await db
      .update(bots)
      .set({ 
        status, 
        lastPing: lastPing || new Date(),
        updatedAt: new Date() 
      })
      .where(eq(bots.id, id));
  }

  async getServers(): Promise<Server[]> {
    return await db.select().from(servers).orderBy(desc(servers.createdAt));
  }

  async getServersByBot(botId: number): Promise<Server[]> {
    return await db.select().from(servers).where(eq(servers.botId, botId));
  }

  async getServer(id: number): Promise<Server | undefined> {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));
    return server || undefined;
  }

  async getServerByGuildId(guildId: string): Promise<Server | undefined> {
    const [server] = await db.select().from(servers).where(eq(servers.guildId, guildId));
    return server || undefined;
  }

  async createServer(server: InsertServer): Promise<Server> {
    const [newServer] = await db.insert(servers).values(server).returning();
    return newServer;
  }

  async updateServer(id: number, server: Partial<InsertServer>): Promise<Server> {
    const [updatedServer] = await db
      .update(servers)
      .set({ ...server, updatedAt: new Date() })
      .where(eq(servers.id, id))
      .returning();
    return updatedServer;
  }

  async deleteServer(id: number): Promise<void> {
    await db.delete(servers).where(eq(servers.id, id));
  }

  async getModerationCommands(serverId: number): Promise<ModerationCommand[]> {
    return await db.select().from(moderationCommands).where(eq(moderationCommands.serverId, serverId));
  }

  async createModerationCommand(command: InsertModerationCommand): Promise<ModerationCommand> {
    const [newCommand] = await db.insert(moderationCommands).values(command).returning();
    return newCommand;
  }

  async updateModerationCommand(id: number, command: Partial<InsertModerationCommand>): Promise<ModerationCommand> {
    const [updatedCommand] = await db
      .update(moderationCommands)
      .set(command)
      .where(eq(moderationCommands.id, id))
      .returning();
    return updatedCommand;
  }

  async deleteModerationCommand(id: number): Promise<void> {
    await db.delete(moderationCommands).where(eq(moderationCommands.id, id));
  }

  async getMusicConfig(serverId: number): Promise<MusicConfig | undefined> {
    const [config] = await db.select().from(musicConfig).where(eq(musicConfig.serverId, serverId));
    return config || undefined;
  }

  async createMusicConfig(config: InsertMusicConfig): Promise<MusicConfig> {
    const [newConfig] = await db.insert(musicConfig).values(config).returning();
    return newConfig;
  }

  async updateMusicConfig(id: number, config: Partial<InsertMusicConfig>): Promise<MusicConfig> {
    const [updatedConfig] = await db
      .update(musicConfig)
      .set(config)
      .where(eq(musicConfig.id, id))
      .returning();
    return updatedConfig;
  }

  async getAntiNukeConfig(serverId: number): Promise<AntiNukeConfig | undefined> {
    const [config] = await db.select().from(antiNukeConfig).where(eq(antiNukeConfig.serverId, serverId));
    return config || undefined;
  }

  async createAntiNukeConfig(config: InsertAntiNukeConfig): Promise<AntiNukeConfig> {
    const [newConfig] = await db.insert(antiNukeConfig).values(config).returning();
    return newConfig;
  }

  async updateAntiNukeConfig(id: number, config: Partial<InsertAntiNukeConfig>): Promise<AntiNukeConfig> {
    const [updatedConfig] = await db
      .update(antiNukeConfig)
      .set(config)
      .where(eq(antiNukeConfig.id, id))
      .returning();
    return updatedConfig;
  }

  async getCustomCommands(serverId: number): Promise<CustomCommand[]> {
    return await db.select().from(customCommands).where(eq(customCommands.serverId, serverId));
  }

  async createCustomCommand(command: InsertCustomCommand): Promise<CustomCommand> {
    const [newCommand] = await db.insert(customCommands).values(command).returning();
    return newCommand;
  }

  async updateCustomCommand(id: number, command: Partial<InsertCustomCommand>): Promise<CustomCommand> {
    const [updatedCommand] = await db
      .update(customCommands)
      .set(command)
      .where(eq(customCommands.id, id))
      .returning();
    return updatedCommand;
  }

  async deleteCustomCommand(id: number): Promise<void> {
    await db.delete(customCommands).where(eq(customCommands.id, id));
  }

  async getActivityLogs(botId?: number, serverId?: number, limit: number = 100): Promise<ActivityLog[]> {
    let query = db.select().from(activityLogs);
    
    if (botId) {
      query = query.where(eq(activityLogs.botId, botId));
    }
    if (serverId) {
      query = query.where(eq(activityLogs.serverId, serverId));
    }
    
    return await query.orderBy(desc(activityLogs.timestamp)).limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log).returning();
    return newLog;
  }
}

const storage = new DatabaseStorage();

module.exports = { storage, DatabaseStorage };
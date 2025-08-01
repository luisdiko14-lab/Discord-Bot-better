const { pgTable, serial, text, boolean, timestamp, integer, jsonb } = require("drizzle-orm/pg-core");
const { relations } = require("drizzle-orm");
const { createInsertSchema } = require("drizzle-zod");
const { z } = require("zod");

// Bot Configuration Table
const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull(),
  clientId: text("client_id").notNull(),
  status: text("status").notNull().default("offline"), // online, offline, maintenance
  prefix: text("prefix").notNull().default("!"),
  isActive: boolean("is_active").notNull().default(true),
  keepAlive: boolean("keep_alive").notNull().default(true),
  lastPing: timestamp("last_ping"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Server/Guild Configuration
const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  name: text("name").notNull(),
  botId: integer("bot_id").references(() => bots.id).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  settings: jsonb("settings").$type<{
    moderationEnabled: boolean;
    musicEnabled: boolean;
    antiNukeEnabled: boolean;
    logChannelId?: string;
    welcomeChannelId?: string;
  }>().notNull().default({
    moderationEnabled: true,
    musicEnabled: true,
    antiNukeEnabled: true,
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Moderation Commands Configuration
const moderationCommands = pgTable("moderation_commands", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => servers.id).notNull(),
  command: text("command").notNull(), // ban, kick, mute, warn, etc.
  isEnabled: boolean("is_enabled").notNull().default(true),
  requiredPermission: text("required_permission").notNull(), // BAN_MEMBERS, KICK_MEMBERS, etc.
  requiredRoles: text("required_roles").array().default([]),
  cooldownSeconds: integer("cooldown_seconds").default(0),
  settings: jsonb("settings").$type<{
    maxDuration?: number;
    defaultReason?: string;
    logAction?: boolean;
    dmUser?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Music Bot Configuration
const musicConfig = pgTable("music_config", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => servers.id).notNull(),
  youtubeEnabled: boolean("youtube_enabled").notNull().default(true),
  spotifyEnabled: boolean("spotify_enabled").notNull().default(true),
  maxQueueSize: integer("max_queue_size").default(100),
  maxTrackDuration: integer("max_track_duration").default(3600), // seconds
  allowedChannels: text("allowed_channels").array().default([]),
  djRoles: text("dj_roles").array().default([]),
  volume: integer("volume").default(50),
  settings: jsonb("settings").$type<{
    autoLeave: boolean;
    autoLeaveTimeout: number;
    loopMode: 'off' | 'track' | 'queue';
    shuffleEnabled: boolean;
  }>().default({
    autoLeave: true,
    autoLeaveTimeout: 300,
    loopMode: 'off',
    shuffleEnabled: false,
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Anti-Nuke Protection Configuration
const antiNukeConfig = pgTable("anti_nuke_config", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => servers.id).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  protectionLevel: text("protection_level").notNull().default("medium"), // low, medium, high, extreme
  whitelistedUsers: text("whitelisted_users").array().default([]),
  whitelistedRoles: text("whitelisted_roles").array().default([]),
  triggers: jsonb("triggers").$type<{
    channelDelete: { enabled: boolean; limit: number; timeframe: number };
    channelCreate: { enabled: boolean; limit: number; timeframe: number };
    roleDelete: { enabled: boolean; limit: number; timeframe: number };
    roleCreate: { enabled: boolean; limit: number; timeframe: number };
    memberBan: { enabled: boolean; limit: number; timeframe: number };
    memberKick: { enabled: boolean; limit: number; timeframe: number };
    webhookCreate: { enabled: boolean; limit: number; timeframe: number };
    botAdd: { enabled: boolean; limit: number; timeframe: number };
  }>().default({
    channelDelete: { enabled: true, limit: 3, timeframe: 60 },
    channelCreate: { enabled: true, limit: 5, timeframe: 60 },
    roleDelete: { enabled: true, limit: 3, timeframe: 60 },
    roleCreate: { enabled: true, limit: 5, timeframe: 60 },
    memberBan: { enabled: true, limit: 5, timeframe: 60 },
    memberKick: { enabled: true, limit: 10, timeframe: 60 },
    webhookCreate: { enabled: true, limit: 2, timeframe: 60 },
    botAdd: { enabled: true, limit: 1, timeframe: 300 },
  }),
  actions: jsonb("actions").$type<{
    removePermissions: boolean;
    banUser: boolean;
    kickUser: boolean;
    removeRoles: boolean;
    lockdown: boolean;
    notifyOwner: boolean;
  }>().default({
    removePermissions: true,
    banUser: true,
    kickUser: false,
    removeRoles: true,
    lockdown: true,
    notifyOwner: true,
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Custom Commands
const customCommands = pgTable("custom_commands", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => servers.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // moderation, music, fun, general
  isEnabled: boolean("is_enabled").notNull().default(true),
  requiredPermissions: text("required_permissions").array().default([]),
  requiredRoles: text("required_roles").array().default([]),
  cooldownSeconds: integer("cooldown_seconds").default(0),
  subcommands: jsonb("subcommands").$type<Array<{
    name: string;
    description: string;
    options?: Array<{
      name: string;
      description: string;
      type: string;
      required: boolean;
    }>;
  }>>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity Logs
const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").references(() => bots.id).notNull(),
  serverId: integer("server_id").references(() => servers.id),
  action: text("action").notNull(),
  userId: text("user_id"),
  details: jsonb("details").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations
const botsRelations = relations(bots, ({ many }) => ({
  servers: many(servers),
  activityLogs: many(activityLogs),
}));

const serversRelations = relations(servers, ({ one, many }) => ({
  bot: one(bots, {
    fields: [servers.botId],
    references: [bots.id],
  }),
  moderationCommands: many(moderationCommands),
  musicConfig: one(musicConfig),
  antiNukeConfig: one(antiNukeConfig),
  customCommands: many(customCommands),
  activityLogs: many(activityLogs),
}));

const moderationCommandsRelations = relations(moderationCommands, ({ one }) => ({
  server: one(servers, {
    fields: [moderationCommands.serverId],
    references: [servers.id],
  }),
}));

const musicConfigRelations = relations(musicConfig, ({ one }) => ({
  server: one(servers, {
    fields: [musicConfig.serverId],
    references: [servers.id],
  }),
}));

const antiNukeConfigRelations = relations(antiNukeConfig, ({ one }) => ({
  server: one(servers, {
    fields: [antiNukeConfig.serverId],
    references: [servers.id],
  }),
}));

const customCommandsRelations = relations(customCommands, ({ one }) => ({
  server: one(servers, {
    fields: [customCommands.serverId],
    references: [servers.id],
  }),
}));

const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  bot: one(bots, {
    fields: [activityLogs.botId],
    references: [bots.id],
  }),
  server: one(servers, {
    fields: [activityLogs.serverId],
    references: [servers.id],
  }),
}));

// Insert Schemas
const insertBotSchema = createInsertSchema(bots).omit({ id: true, createdAt: true, updatedAt: true });
const insertServerSchema = createInsertSchema(servers).omit({ id: true, createdAt: true, updatedAt: true });
const insertModerationCommandSchema = createInsertSchema(moderationCommands).omit({ id: true, createdAt: true });
const insertMusicConfigSchema = createInsertSchema(musicConfig).omit({ id: true, createdAt: true });
const insertAntiNukeConfigSchema = createInsertSchema(antiNukeConfig).omit({ id: true, createdAt: true });
const insertCustomCommandSchema = createInsertSchema(customCommands).omit({ id: true, createdAt: true });
const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, timestamp: true });

// Export everything
module.exports = {
  bots,
  servers,
  moderationCommands,
  musicConfig,
  antiNukeConfig,
  customCommands,
  activityLogs,
  botsRelations,
  serversRelations,
  moderationCommandsRelations,
  musicConfigRelations,
  antiNukeConfigRelations,
  customCommandsRelations,
  activityLogsRelations,
  insertBotSchema,
  insertServerSchema,
  insertModerationCommandSchema,
  insertMusicConfigSchema,
  insertAntiNukeConfigSchema,
  insertCustomCommandSchema,
  insertActivityLogSchema
};
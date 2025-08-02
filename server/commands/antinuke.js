const { SlashCommandBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');

// Anti-nuke tracking
const actionCounts = new Map(); // guildId -> userId -> actionType -> count/timestamp
const protectedGuilds = new Map(); // guildId -> config

class AntiNukeMonitor {
  constructor(client) {
    this.client = client;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Channel events
    this.client.on('channelDelete', this.handleChannelDelete.bind(this));
    this.client.on('channelCreate', this.handleChannelCreate.bind(this));
    
    // Role events
    this.client.on('roleDelete', this.handleRoleDelete.bind(this));
    this.client.on('roleCreate', this.handleRoleCreate.bind(this));
    
    // Member events
    this.client.on('guildBanAdd', this.handleMemberBan.bind(this));
    this.client.on('guildMemberRemove', this.handleMemberKick.bind(this));
    
    // Webhook events
    this.client.on('webhookUpdate', this.handleWebhookUpdate.bind(this));
  }

  async getAuditLogEntry(guild, action, target = null) {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: action,
        limit: 1
      });
      
      const entry = auditLogs.entries.first();
      if (!entry) return null;
      
      // Check if entry is recent (within last 5 seconds)
      if (Date.now() - entry.createdTimestamp > 5000) return null;
      
      if (target && entry.target?.id !== target.id) return null;
      
      return entry;
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return null;
    }
  }

  async handleChannelDelete(channel) {
    if (!channel.guild) return;
    
    const config = protectedGuilds.get(channel.guild.id);
    if (!config?.isEnabled || !config.triggers?.channelDelete?.enabled) return;

    const entry = await this.getAuditLogEntry(channel.guild, AuditLogEvent.ChannelDelete, channel);
    if (!entry) return;

    await this.checkAndAct(channel.guild, entry.executor, 'channelDelete', config, {
      channel: channel.name,
      type: channel.type
    });
  }

  async handleChannelCreate(channel) {
    if (!channel.guild) return;
    
    const config = protectedGuilds.get(channel.guild.id);
    if (!config?.isEnabled || !config.triggers?.channelCreate?.enabled) return;

    const entry = await this.getAuditLogEntry(channel.guild, AuditLogEvent.ChannelCreate, channel);
    if (!entry) return;

    await this.checkAndAct(channel.guild, entry.executor, 'channelCreate', config, {
      channel: channel.name,
      type: channel.type
    });
  }

  async handleRoleDelete(role) {
    const config = protectedGuilds.get(role.guild.id);
    if (!config?.isEnabled || !config.triggers?.roleDelete?.enabled) return;

    const entry = await this.getAuditLogEntry(role.guild, AuditLogEvent.RoleDelete, role);
    if (!entry) return;

    await this.checkAndAct(role.guild, entry.executor, 'roleDelete', config, {
      role: role.name,
      permissions: role.permissions.toArray()
    });
  }

  async handleRoleCreate(role) {
    const config = protectedGuilds.get(role.guild.id);
    if (!config?.isEnabled || !config.triggers?.roleCreate?.enabled) return;

    const entry = await this.getAuditLogEntry(role.guild, AuditLogEvent.RoleCreate, role);
    if (!entry) return;

    await this.checkAndAct(role.guild, entry.executor, 'roleCreate', config, {
      role: role.name,
      permissions: role.permissions.toArray()
    });
  }

  async handleMemberBan(ban) {
    const config = protectedGuilds.get(ban.guild.id);
    if (!config?.isEnabled || !config.triggers?.memberBan?.enabled) return;

    const entry = await this.getAuditLogEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user);
    if (!entry) return;

    await this.checkAndAct(ban.guild, entry.executor, 'memberBan', config, {
      banned: ban.user.tag,
      reason: ban.reason
    });
  }

  async handleMemberKick(member) {
    const config = protectedGuilds.get(member.guild.id);
    if (!config?.isEnabled || !config.triggers?.memberKick?.enabled) return;

    const entry = await this.getAuditLogEntry(member.guild, AuditLogEvent.MemberKick, member.user);
    if (!entry) return;

    await this.checkAndAct(member.guild, entry.executor, 'memberKick', config, {
      kicked: member.user.tag
    });
  }

  async handleWebhookUpdate(channel) {
    if (!channel.guild) return;
    
    const config = protectedGuilds.get(channel.guild.id);
    if (!config?.isEnabled || !config.triggers?.webhookCreate?.enabled) return;

    const entry = await this.getAuditLogEntry(channel.guild, AuditLogEvent.WebhookCreate);
    if (!entry) return;

    await this.checkAndAct(channel.guild, entry.executor, 'webhookCreate', config, {
      channel: channel.name
    });
  }

  async checkAndAct(guild, user, actionType, config, details = {}) {
    // Skip if user is whitelisted
    if (config.whitelistedUsers?.includes(user.id)) return;
    
    // Skip if user has whitelisted role
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && config.whitelistedRoles?.some(roleId => member.roles.cache.has(roleId))) return;

    // Skip if user is guild owner
    if (user.id === guild.ownerId) return;

    // Get or create action tracking
    const guildKey = guild.id;
    const userKey = user.id;
    
    if (!actionCounts.has(guildKey)) {
      actionCounts.set(guildKey, new Map());
    }
    
    const guildActions = actionCounts.get(guildKey);
    if (!guildActions.has(userKey)) {
      guildActions.set(userKey, new Map());
    }
    
    const userActions = guildActions.get(userKey);
    
    const trigger = config.triggers[actionType];
    const now = Date.now();
    const timeWindow = trigger.timeframe * 1000; // Convert to milliseconds
    
    // Clean old entries
    if (userActions.has(actionType)) {
      const actions = userActions.get(actionType).filter(timestamp => now - timestamp < timeWindow);
      userActions.set(actionType, actions);
    } else {
      userActions.set(actionType, []);
    }
    
    // Add current action
    userActions.get(actionType).push(now);
    
    const actionCount = userActions.get(actionType).length;
    
    // Check if limit exceeded
    if (actionCount >= trigger.limit) {
      console.log(`🚨 Anti-nuke triggered: ${user.tag} performed ${actionCount} ${actionType} actions in ${trigger.timeframe}s`);
      await this.executeActions(guild, member, config, actionType, actionCount, details);
      
      // Clear actions after punishment
      userActions.set(actionType, []);
    }
  }

  async executeActions(guild, member, config, triggerType, actionCount, details) {
    const actions = config.actions;
    const logMessages = [];

    try {
      // Remove permissions
      if (actions.removePermissions && member) {
        const highestRole = member.roles.highest;
        await member.roles.remove(member.roles.cache.filter(role => role.id !== guild.id));
        logMessages.push(`✅ Removed all roles from ${member.user.tag}`);
      }

      // Ban user
      if (actions.banUser && member) {
        await member.ban({ reason: `Anti-nuke: ${actionCount} ${triggerType} actions detected` });
        logMessages.push(`✅ Banned ${member.user.tag}`);
      }
      // Kick user (only if not banned)
      else if (actions.kickUser && member) {
        await member.kick(`Anti-nuke: ${actionCount} ${triggerType} actions detected`);
        logMessages.push(`✅ Kicked ${member.user.tag}`);
      }

      // Server lockdown
      if (actions.lockdown) {
        const everyoneRole = guild.roles.everyone;
        await everyoneRole.setPermissions([], 'Anti-nuke lockdown activated');
        logMessages.push(`🔒 Server lockdown activated`);
      }

      // Notify owner
      if (actions.notifyOwner) {
        const owner = await guild.fetchOwner();
        try {
          await owner.send({
            embeds: [{
              title: '🚨 Anti-Nuke Alert',
              description: `**Server:** ${guild.name}\n**User:** ${member?.user.tag || 'Unknown'}\n**Action:** ${triggerType}\n**Count:** ${actionCount}\n**Details:** ${JSON.stringify(details, null, 2)}`,
              color: 0xff0000,
              timestamp: new Date().toISOString()
            }]
          });
        } catch (error) {
          console.log('Could not send DM to server owner');
        }
      }

      console.log('Anti-nuke actions executed:', logMessages.join(', '));

    } catch (error) {
      console.error('Error executing anti-nuke actions:', error);
    }
  }
}

module.exports = {
  AntiNukeMonitor,
  
  // Load anti-nuke configuration
  loadConfig: (guildId, config) => {
    protectedGuilds.set(guildId, config);
  },

  // Remove configuration
  unloadConfig: (guildId) => {
    protectedGuilds.delete(guildId);
    actionCounts.delete(guildId);
  },

  // Manual trigger command for testing
  test: {
    data: new SlashCommandBuilder()
      .setName('antinuke-test')
      .setDescription('Test anti-nuke protection (Admin only)')
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Action type to test')
          .setRequired(true)
          .addChoices(
            { name: 'Channel Delete', value: 'channelDelete' },
            { name: 'Channel Create', value: 'channelCreate' },
            { name: 'Role Delete', value: 'roleDelete' },
            { name: 'Role Create', value: 'roleCreate' },
            { name: 'Member Ban', value: 'memberBan' },
            { name: 'Member Kick', value: 'memberKick' },
            { name: 'Webhook Create', value: 'webhookCreate' }
          ))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, config) {
      if (!config?.isEnabled) {
        return await interaction.reply({ content: '❌ Anti-nuke protection is not enabled on this server.', ephemeral: true });
      }

      const actionType = interaction.options.getString('action');
      const trigger = config.triggers[actionType];

      if (!trigger?.enabled) {
        return await interaction.reply({ content: `❌ ${actionType} protection is not enabled.`, ephemeral: true });
      }

      await interaction.reply({
        embeds: [{
          title: '🛡️ Anti-Nuke Test',
          fields: [
            { name: 'Action Type', value: actionType, inline: true },
            { name: 'Trigger Limit', value: trigger.limit.toString(), inline: true },
            { name: 'Time Window', value: `${trigger.timeframe}s`, inline: true },
            { name: 'Protection Level', value: config.protectionLevel, inline: true },
            { name: 'Actions Enabled', value: Object.entries(config.actions).filter(([_, enabled]) => enabled).map(([action, _]) => action).join(', ') || 'None', inline: false }
          ],
          color: 0x00ff00,
          footer: { text: 'Anti-nuke protection is active' }
        }],
        ephemeral: true
      });
    }
  },

  // Status command
  status: {
    data: new SlashCommandBuilder()
      .setName('antinuke-status')
      .setDescription('Check anti-nuke protection status')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, config) {
      if (!config) {
        return await interaction.reply({ content: '❌ Anti-nuke protection is not configured for this server.', ephemeral: true });
      }

      const enabledTriggers = Object.entries(config.triggers)
        .filter(([_, trigger]) => trigger.enabled)
        .map(([name, trigger]) => `${name}: ${trigger.limit}/${trigger.timeframe}s`);

      const enabledActions = Object.entries(config.actions)
        .filter(([_, enabled]) => enabled)
        .map(([action, _]) => action);

      await interaction.reply({
        embeds: [{
          title: '🛡️ Anti-Nuke Protection Status',
          fields: [
            { name: 'Status', value: config.isEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Protection Level', value: config.protectionLevel, inline: true },
            { name: 'Whitelisted Users', value: config.whitelistedUsers?.length || 0, inline: true },
            { name: 'Whitelisted Roles', value: config.whitelistedRoles?.length || 0, inline: true },
            { name: 'Active Triggers', value: enabledTriggers.join('\n') || 'None', inline: false },
            { name: 'Enabled Actions', value: enabledActions.join(', ') || 'None', inline: false }
          ],
          color: config.isEnabled ? 0x00ff00 : 0xff0000,
          timestamp: new Date().toISOString()
        }],
        ephemeral: true
      });
    }
  }
};
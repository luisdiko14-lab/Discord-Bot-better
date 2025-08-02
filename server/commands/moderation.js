const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  // Ban Command
  ban: {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a member from the server')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The member to ban')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the ban')
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('days')
          .setDescription('Number of days of messages to delete (0-7)')
          .setMinValue(0)
          .setMaxValue(7)
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction, config) {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteMessageDays = interaction.options.getInteger('days') || 0;

      // Check if user can be banned
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        return await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      }

      if (member.id === interaction.user.id) {
        return await interaction.reply({ content: 'You cannot ban yourself.', ephemeral: true });
      }

      if (member.id === interaction.guild.ownerId) {
        return await interaction.reply({ content: 'Cannot ban the server owner.', ephemeral: true });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return await interaction.reply({ content: 'You cannot ban someone with equal or higher roles.', ephemeral: true });
      }

      try {
        // Send DM before ban if enabled
        if (config?.settings?.dmUser) {
          try {
            await target.send(`You have been banned from **${interaction.guild.name}**\nReason: ${reason}\nBanned by: ${interaction.user.tag}`);
          } catch (error) {
            console.log('Could not send DM to user');
          }
        }

        // Execute ban
        await member.ban({ 
          reason: `${reason} | Banned by: ${interaction.user.tag}`,
          deleteMessageDays: deleteMessageDays
        });

        await interaction.reply({
          content: `✅ **${target.tag}** has been banned.\n**Reason:** ${reason}`,
          ephemeral: false
        });

        // Log action if enabled
        if (config?.settings?.logAction) {
          // This would integrate with your logging system
          console.log(`Ban executed: ${target.tag} banned by ${interaction.user.tag} for: ${reason}`);
        }

      } catch (error) {
        console.error('Ban command error:', error);
        await interaction.reply({ content: 'An error occurred while trying to ban the user.', ephemeral: true });
      }
    }
  },

  // Kick Command
  kick: {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member from the server')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The member to kick')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the kick')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction, config) {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        return await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      }

      if (member.id === interaction.user.id) {
        return await interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
      }

      if (member.id === interaction.guild.ownerId) {
        return await interaction.reply({ content: 'Cannot kick the server owner.', ephemeral: true });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return await interaction.reply({ content: 'You cannot kick someone with equal or higher roles.', ephemeral: true });
      }

      try {
        // Send DM before kick if enabled
        if (config?.settings?.dmUser) {
          try {
            await target.send(`You have been kicked from **${interaction.guild.name}**\nReason: ${reason}\nKicked by: ${interaction.user.tag}`);
          } catch (error) {
            console.log('Could not send DM to user');
          }
        }

        await member.kick(`${reason} | Kicked by: ${interaction.user.tag}`);

        await interaction.reply({
          content: `✅ **${target.tag}** has been kicked.\n**Reason:** ${reason}`,
          ephemeral: false
        });

        if (config?.settings?.logAction) {
          console.log(`Kick executed: ${target.tag} kicked by ${interaction.user.tag} for: ${reason}`);
        }

      } catch (error) {
        console.error('Kick command error:', error);
        await interaction.reply({ content: 'An error occurred while trying to kick the user.', ephemeral: true });
      }
    }
  },

  // Mute Command (Timeout)
  mute: {
    data: new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Timeout a member')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The member to mute')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('duration')
          .setDescription('Duration in minutes (1-40320 = 28 days max)')
          .setMinValue(1)
          .setMaxValue(40320)
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the mute')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, config) {
      const target = interaction.options.getUser('target');
      const duration = interaction.options.getInteger('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        return await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      }

      if (member.id === interaction.user.id) {
        return await interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
      }

      if (member.id === interaction.guild.ownerId) {
        return await interaction.reply({ content: 'Cannot mute the server owner.', ephemeral: true });
      }

      if (member.roles.highest.position >= interaction.member.roles.highest.position) {
        return await interaction.reply({ content: 'You cannot mute someone with equal or higher roles.', ephemeral: true });
      }

      try {
        const timeoutDuration = duration * 60 * 1000; // Convert minutes to milliseconds
        
        await member.timeout(timeoutDuration, `${reason} | Muted by: ${interaction.user.tag}`);

        // Send DM if enabled
        if (config?.settings?.dmUser) {
          try {
            await target.send(`You have been muted in **${interaction.guild.name}**\nDuration: ${duration} minutes\nReason: ${reason}\nMuted by: ${interaction.user.tag}`);
          } catch (error) {
            console.log('Could not send DM to user');
          }
        }

        await interaction.reply({
          content: `✅ **${target.tag}** has been muted for **${duration} minutes**.\n**Reason:** ${reason}`,
          ephemeral: false
        });

        if (config?.settings?.logAction) {
          console.log(`Mute executed: ${target.tag} muted by ${interaction.user.tag} for ${duration} minutes. Reason: ${reason}`);
        }

      } catch (error) {
        console.error('Mute command error:', error);
        await interaction.reply({ content: 'An error occurred while trying to mute the user.', ephemeral: true });
      }
    }
  },

  // Unmute Command
  unmute: {
    data: new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Remove timeout from a member')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The member to unmute')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the unmute')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, config) {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        return await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      }

      if (!member.isCommunicationDisabled()) {
        return await interaction.reply({ content: 'This user is not currently muted.', ephemeral: true });
      }

      try {
        await member.timeout(null, `${reason} | Unmuted by: ${interaction.user.tag}`);

        await interaction.reply({
          content: `✅ **${target.tag}** has been unmuted.\n**Reason:** ${reason}`,
          ephemeral: false
        });

        if (config?.settings?.logAction) {
          console.log(`Unmute executed: ${target.tag} unmuted by ${interaction.user.tag}. Reason: ${reason}`);
        }

      } catch (error) {
        console.error('Unmute command error:', error);
        await interaction.reply({ content: 'An error occurred while trying to unmute the user.', ephemeral: true });
      }
    }
  }
};
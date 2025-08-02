const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { spawn } = require('child_process');

// Music queue management
const queues = new Map();

class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.songs = [];
    this.volume = 0.5;
    this.playing = false;
    this.connection = null;
    this.player = null;
    this.loop = false;
    this.shuffle = false;
  }

  add(song) {
    this.songs.push(song);
  }

  skip() {
    if (this.songs.length > 0) {
      if (!this.loop) {
        this.songs.shift();
      }
      return this.songs[0] || null;
    }
    return null;
  }

  clear() {
    this.songs = [];
    this.playing = false;
  }
}

module.exports = {
  // Play Command
  play: {
    data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play music from YouTube or Spotify')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Song name, YouTube URL, or Spotify URL')
          .setRequired(true))
      .addBooleanOption(option =>
        option.setName('next')
          .setDescription('Add to front of queue')
          .setRequired(false)),

    async execute(interaction, config) {
      const query = interaction.options.getString('query');
      const playNext = interaction.options.getBoolean('next') || false;

      // Check if user is in voice channel
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        return await interaction.reply({ content: '❌ You need to be in a voice channel to play music!', ephemeral: true });
      }

      // Check bot permissions
      const permissions = voiceChannel.permissionsFor(interaction.client.user);
      if (!permissions.has(['Connect', 'Speak'])) {
        return await interaction.reply({ content: '❌ I need Connect and Speak permissions in your voice channel!', ephemeral: true });
      }

      await interaction.deferReply();

      try {
        // Get or create queue
        let queue = queues.get(interaction.guild.id);
        if (!queue) {
          queue = new MusicQueue(interaction.guild.id);
          queues.set(interaction.guild.id, queue);
        }

        // Parse song info
        let songInfo;
        if (ytdl.validateURL(query)) {
          // YouTube URL
          if (!config?.youtubeEnabled) {
            return await interaction.editReply('❌ YouTube playback is disabled on this server.');
          }
          songInfo = await ytdl.getInfo(query);
        } else if (query.includes('spotify.com')) {
          // Spotify URL
          if (!config?.spotifyEnabled) {
            return await interaction.editReply('❌ Spotify playback is disabled on this server.');
          }
          // Note: Spotify requires special handling with Spotify API + YouTube search
          return await interaction.editReply('🎵 Spotify integration requires additional setup. Please use YouTube links for now.');
        } else {
          // Search YouTube using ytdl-core's search capabilities
          if (!config?.youtubeEnabled) {
            return await interaction.editReply('❌ YouTube search is disabled on this server.');
          }
          
          try {
            // Use ytdl-core to search YouTube (basic search by treating query as video title)
            const searchUrl = `ytsearch:${query}`;
            songInfo = await ytdl.getInfo(searchUrl);
          } catch (error) {
            return await interaction.editReply('❌ Could not find that song on YouTube. Please try a direct YouTube URL.');
          }
        }

        const song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          duration: parseInt(songInfo.videoDetails.lengthSeconds),
          thumbnail: songInfo.videoDetails.thumbnails[0]?.url,
          requestedBy: interaction.user
        };

        // Check duration limit
        if (config?.maxTrackDuration && song.duration > config.maxTrackDuration) {
          return await interaction.editReply(`❌ Track duration (${Math.floor(song.duration / 60)}:${song.duration % 60}) exceeds server limit of ${Math.floor(config.maxTrackDuration / 60)} minutes.`);
        }

        // Check queue size limit
        if (config?.maxQueueSize && queue.songs.length >= config.maxQueueSize) {
          return await interaction.editReply(`❌ Queue is full! Maximum queue size is ${config.maxQueueSize} songs.`);
        }

        // Add to queue
        if (playNext && queue.songs.length > 0) {
          queue.songs.splice(1, 0, song); // Add after current song
        } else {
          queue.add(song);
        }

        if (!queue.playing) {
          // Start playing
          queue.playing = true;
          await this.play(queue, voiceChannel, interaction);
        } else {
          await interaction.editReply(`🎵 **${song.title}** added to queue at position ${queue.songs.length}`);
        }

      } catch (error) {
        console.error('Play command error:', error);
        await interaction.editReply('❌ An error occurred while trying to play the song.');
      }
    },

    async play(queue, voiceChannel, interaction) {
      const song = queue.songs[0];
      if (!song) {
        queue.playing = false;
        if (queue.connection) {
          queue.connection.destroy();
          queue.connection = null;
        }
        return;
      }

      try {
        // Join voice channel
        if (!queue.connection) {
          queue.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          });
        }

        // Create audio player
        if (!queue.player) {
          queue.player = createAudioPlayer();
          queue.connection.subscribe(queue.player);
        }

        // Create audio resource
        const stream = ytdl(song.url, { 
          filter: 'audioonly',
          quality: 'highestaudio',
          highWaterMark: 1 << 25
        });
        
        const resource = createAudioResource(stream, { inlineVolume: true });
        resource.volume.setVolume(queue.volume);

        queue.player.play(resource);

        await interaction.editReply(`🎵 Now playing: **${song.title}**`);

        // Handle player events
        queue.player.on(AudioPlayerStatus.Idle, () => {
          if (!queue.loop) {
            queue.songs.shift();
          }
          this.play(queue, voiceChannel, interaction);
        });

        queue.player.on('error', error => {
          console.error('Audio player error:', error);
          queue.songs.shift();
          this.play(queue, voiceChannel, interaction);
        });

      } catch (error) {
        console.error('Play function error:', error);
        queue.songs.shift();
        this.play(queue, voiceChannel, interaction);
      }
    }
  },

  // Stop Command
  stop: {
    data: new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Stop music and clear queue'),

    async execute(interaction, config) {
      const queue = queues.get(interaction.guild.id);
      if (!queue || !queue.playing) {
        return await interaction.reply({ content: '❌ No music is currently playing!', ephemeral: true });
      }

      queue.clear();
      if (queue.player) {
        queue.player.stop();
      }
      if (queue.connection) {
        queue.connection.destroy();
        queue.connection = null;
      }

      queues.delete(interaction.guild.id);
      await interaction.reply('⏹️ Music stopped and queue cleared!');
    }
  },

  // Skip Command
  skip: {
    data: new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Skip the current song'),

    async execute(interaction, config) {
      const queue = queues.get(interaction.guild.id);
      if (!queue || !queue.playing) {
        return await interaction.reply({ content: '❌ No music is currently playing!', ephemeral: true });
      }

      if (queue.player) {
        queue.player.stop(); // This will trigger the Idle event and play next song
      }

      await interaction.reply('⏭️ Skipped current song!');
    }
  },

  // Queue Command
  queue: {
    data: new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Show the music queue'),

    async execute(interaction, config) {
      const queue = queues.get(interaction.guild.id);
      if (!queue || queue.songs.length === 0) {
        return await interaction.reply({ content: '❌ Queue is empty!', ephemeral: true });
      }

      const queueList = queue.songs.slice(0, 10).map((song, index) => {
        const duration = `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}`;
        return `${index === 0 ? '🎵' : `${index}.`} **${song.title}** (${duration}) - ${song.requestedBy}`;
      }).join('\n');

      const embed = {
        title: '🎵 Music Queue',
        description: queueList,
        color: 0x00ff00,
        footer: {
          text: `${queue.songs.length} songs in queue`
        }
      };

      await interaction.reply({ embeds: [embed] });
    }
  },

  // Volume Command
  volume: {
    data: new SlashCommandBuilder()
      .setName('volume')
      .setDescription('Set music volume')
      .addIntegerOption(option =>
        option.setName('level')
          .setDescription('Volume level (1-100)')
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)),

    async execute(interaction, config) {
      const volume = interaction.options.getInteger('level');
      const queue = queues.get(interaction.guild.id);
      
      if (!queue || !queue.playing) {
        return await interaction.reply({ content: '❌ No music is currently playing!', ephemeral: true });
      }

      queue.volume = volume / 100;
      if (queue.player && queue.player.state.resource) {
        queue.player.state.resource.volume.setVolume(queue.volume);
      }

      await interaction.reply(`🔊 Volume set to **${volume}%**`);
    }
  }
};
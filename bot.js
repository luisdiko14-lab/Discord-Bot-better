require('dotenv').config();
const DiscordBot = require('./server/discord-bot');

// Bot configuration
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!BOT_TOKEN || !CLIENT_ID) {
  console.error('❌ Missing required environment variables:');
  if (!BOT_TOKEN) console.error('  - DISCORD_BOT_TOKEN');
  if (!CLIENT_ID) console.error('  - DISCORD_CLIENT_ID');
  console.error('Please add these secrets in the Replit Secrets tab.');
  process.exit(1);
}

// Create and start the bot
const bot = new DiscordBot(BOT_TOKEN, CLIENT_ID);

async function startBot() {
  try {
    console.log('🤖 Starting Discord bot...');
    await bot.start();
    console.log('✅ Discord bot is now running!');
    console.log(`📊 Bot Status: ${JSON.stringify(bot.getStatus(), null, 2)}`);
  } catch (error) {
    console.error('❌ Failed to start Discord bot:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
startBot();
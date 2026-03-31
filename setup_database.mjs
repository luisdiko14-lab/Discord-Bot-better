import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

// ✅ Fix: provide WebSocket implementation for Node.js
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('Setting up database tables...');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        token TEXT NOT NULL,
        client_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'offline',
        prefix TEXT NOT NULL DEFAULT '!',
        is_active BOOLEAN NOT NULL DEFAULT true,
        keep_alive BOOLEAN NOT NULL DEFAULT true,
        last_ping TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        bot_id INTEGER REFERENCES bots(id) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        settings JSONB NOT NULL DEFAULT '{"moderationEnabled": true, "musicEnabled": true, "antiNukeEnabled": true}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS moderation_commands (
        id SERIAL PRIMARY KEY,
        server_id INTEGER REFERENCES servers(id) NOT NULL,
        command TEXT NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        required_permission TEXT NOT NULL,
        required_roles TEXT[] DEFAULT '{}',
        cooldown_seconds INTEGER DEFAULT 0,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS music_config (
        id SERIAL PRIMARY KEY,
        server_id INTEGER REFERENCES servers(id) NOT NULL,
        youtube_enabled BOOLEAN NOT NULL DEFAULT true,
        spotify_enabled BOOLEAN NOT NULL DEFAULT true,
        max_queue_size INTEGER DEFAULT 100,
        max_track_duration INTEGER DEFAULT 3600,
        allowed_channels TEXT[] DEFAULT '{}',
        dj_roles TEXT[] DEFAULT '{}',
        volume INTEGER DEFAULT 50,
        settings JSONB DEFAULT '{"autoLeave": true, "autoLeaveTimeout": 300, "loopMode": "off", "shuffleEnabled": false}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS anti_nuke_config (
        id SERIAL PRIMARY KEY,
        server_id INTEGER REFERENCES servers(id) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        protection_level TEXT NOT NULL DEFAULT 'medium',
        whitelisted_users TEXT[] DEFAULT '{}',
        whitelisted_roles TEXT[] DEFAULT '{}',
        triggers JSONB DEFAULT '{"channelDelete": {"enabled": true, "limit": 3, "timeframe": 60}, "channelCreate": {"enabled": true, "limit": 5, "timeframe": 60}, "roleDelete": {"enabled": true, "limit": 3, "timeframe": 60}, "roleCreate": {"enabled": true, "limit": 5, "timeframe": 60}, "memberBan": {"enabled": true, "limit": 5, "timeframe": 60}, "memberKick": {"enabled": true, "limit": 10, "timeframe": 60}, "webhookCreate": {"enabled": true, "limit": 2, "timeframe": 60}, "botAdd": {"enabled": true, "limit": 1, "timeframe": 300}}'::jsonb,
        actions JSONB DEFAULT '{"removePermissions": true, "banUser": true, "kickUser": false, "removeRoles": true, "lockdown": true, "notifyOwner": true}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_commands (
        id SERIAL PRIMARY KEY,
        server_id INTEGER REFERENCES servers(id) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'general',
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        required_permissions TEXT[] DEFAULT '{}',
        required_roles TEXT[] DEFAULT '{}',
        cooldown_seconds INTEGER DEFAULT 0,
        subcommands JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES bots(id) NOT NULL,
        server_id INTEGER REFERENCES servers(id),
        action TEXT NOT NULL,
        user_id TEXT,
        details JSONB DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Database setup completed successfully!');

    // Insert sample data
    console.log('Inserting sample data...');

    const sampleBot = await client.query(`
      INSERT INTO bots (name, token, client_id, prefix, keep_alive)
      VALUES ('Demo Bot', 'demo_token_replace_with_real', '123456789012345678', '!', true)
      ON CONFLICT (client_id) DO NOTHING
      RETURNING id;
    `);

    if (sampleBot.rows.length > 0) {
      await client.query(`
        INSERT INTO activity_logs (bot_id, action, details)
        VALUES ($1, 'Bot Created', '{"message": "Demo bot initialized"}');
      `, [sampleBot.rows[0].id]);
    }

    console.log('Sample data inserted successfully!');

  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    client.release();
  }
}

setupDatabase().catch(console.error);
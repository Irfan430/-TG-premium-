const { Telegraf } = require('telegraf');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Import utilities and middlewares
const logger = require('./utils/logger');
const fileHelper = require('./utils/fileHelper');
const isAdmin = require('./middlewares/isAdmin');
const floodControl = require('./middlewares/floodControl');

// Load configuration
let config;
try {
  config = require('./config.json');
} catch (error) {
  console.error('❌ Error loading config.json:', error.message);
  process.exit(1);
}

// Get bot token from environment or config
const BOT_TOKEN = process.env.BOT_TOKEN || config.BOT_TOKEN;

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
  console.error('❌ Please set your BOT_TOKEN in config.json or .env file');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);

// Global error handling
bot.catch((err, ctx) => {
  console.error('❌ Bot Error:', err);
  logger.log({
    type: 'error',
    userId: ctx.from?.id,
    username: ctx.from?.username,
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

// Process monitoring
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Apply global middlewares
bot.use(floodControl);

// Auto-register new users
bot.use(async (ctx, next) => {
  if (ctx.from && !ctx.from.is_bot) {
    await fileHelper.addUser({
      id: ctx.from.id,
      username: ctx.from.username || 'Unknown',
      first_name: ctx.from.first_name || 'Unknown',
      last_name: ctx.from.last_name || '',
      language_code: ctx.from.language_code || 'en',
      joined_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    });
  }
  return next();
});

// Command logging middleware
bot.use(async (ctx, next) => {
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
    logger.log({
      type: 'command',
      userId: ctx.from.id,
      username: ctx.from.username || 'Unknown',
      command: ctx.message.text,
      chatType: ctx.chat.type,
      timestamp: new Date().toISOString()
    });
  }
  return next();
});

// Auto command loader function
async function loadCommands() {
  console.log('🔄 Loading commands...');
  
  const commandsPath = path.join(__dirname, 'commands');
  
  // Load user commands
  const userCommandsPath = path.join(commandsPath, 'users');
  if (await fs.pathExists(userCommandsPath)) {
    const userCommandFiles = await fs.readdir(userCommandsPath);
    
    for (const file of userCommandFiles) {
      if (file.endsWith('.js')) {
        try {
          const commandPath = path.join(userCommandsPath, file);
          const command = require(commandPath);
          
          if (command.name && command.execute) {
            bot.command(command.name, command.execute);
            console.log(`✅ Loaded user command: /${command.name}`);
            
            // Register callback handlers if available
            if (command.handleCallbacks) {
              command.handleCallbacks(bot);
              console.log(`✅ Registered callbacks for: /${command.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error loading user command ${file}:`, error.message);
        }
      }
    }
  }
  
  // Load admin commands
  const adminCommandsPath = path.join(commandsPath, 'admins');
  if (await fs.pathExists(adminCommandsPath)) {
    const adminCommandFiles = await fs.readdir(adminCommandsPath);
    
    for (const file of adminCommandFiles) {
      if (file.endsWith('.js')) {
        try {
          const commandPath = path.join(adminCommandsPath, file);
          const command = require(commandPath);
          
          if (command.name && command.execute) {
            bot.command(command.name, isAdmin, command.execute);
            console.log(`✅ Loaded admin command: /${command.name}`);
            
            // Register callback handlers if available
            if (command.handleCallbacks) {
              command.handleCallbacks(bot);
              console.log(`✅ Registered callbacks for admin: /${command.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error loading admin command ${file}:`, error.message);
        }
      }
    }
  }
}

// Initialize data files
async function initializeData() {
  console.log('🔄 Initializing data files...');
  
  const dataPath = path.join(__dirname, 'data');
  await fs.ensureDir(dataPath);
  
  // Initialize users.json
  const usersFile = path.join(dataPath, 'users.json');
  if (!await fs.pathExists(usersFile)) {
    await fs.writeJSON(usersFile, []);
    console.log('✅ Created users.json');
  }
  
  // Initialize logs.json
  const logsFile = path.join(dataPath, 'logs.json');
  if (!await fs.pathExists(logsFile)) {
    await fs.writeJSON(logsFile, []);
    console.log('✅ Created logs.json');
  }
  
  // Ensure downloads directory exists
  const downloadsPath = path.join(__dirname, 'public', 'downloads');
  await fs.ensureDir(downloadsPath);
  console.log('✅ Ensured downloads directory exists');
}

// Start bot
async function startBot() {
  try {
    // Initialize data files first
    await initializeData();
    
    // Load all commands
    await loadCommands();
    
    // Start polling
    console.log('🚀 Starting bot...');
    await bot.launch();
    
    console.log('✅ Bot is running successfully!');
    console.log(`📱 Bot Username: @${bot.botInfo.username}`);
    
    // Log bot start
    logger.log({
      type: 'system',
      message: 'Bot started successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  logger.log({
    type: 'system',
    message: 'Bot shutdown initiated',
    timestamp: new Date().toISOString()
  });
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  logger.log({
    type: 'system',
    message: 'Bot shutdown initiated',
    timestamp: new Date().toISOString()
  });
  bot.stop('SIGTERM');
});

// Start the bot
startBot();
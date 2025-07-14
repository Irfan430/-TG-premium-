const { Markup } = require('telegraf');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config.json');
const fileHelper = require('../../utils/fileHelper');
const logger = require('../../utils/logger');

// Load language files
const languages = {};
const langDir = path.join(__dirname, '..', '..', 'lang');

// Load all language files
fs.readdirSync(langDir).forEach(file => {
  if (file.endsWith('.json')) {
    const lang = file.replace('.json', '');
    languages[lang] = require(path.join(langDir, file));
  }
});

/**
 * Get text in user's language with fallback to English
 * @param {string} lang - Language code
 * @param {string} key - Text key (dot notation)
 * @param {Object} params - Parameters for text replacement
 * @returns {string} Localized text
 */
function getText(lang, key, params = {}) {
  const langData = languages[lang] || languages['en'] || {};
  
  // Navigate through nested object using dot notation
  const keys = key.split('.');
  let text = langData;
  
  for (const k of keys) {
    text = text?.[k];
    if (!text) break;
  }
  
  // Fallback to English if text not found
  if (!text && lang !== 'en') {
    const englishData = languages['en'] || {};
    text = englishData;
    for (const k of keys) {
      text = text?.[k];
      if (!text) break;
    }
  }
  
  // If still no text found, return the key
  if (!text) {
    return key;
  }
  
  // Replace parameters in text
  let result = text;
  for (const [param, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`{${param}}`, 'g'), value);
  }
  
  return result;
}

/**
 * Start command handler
 * @param {Object} ctx - Telegraf context
 */
async function execute(ctx) {
  try {
    const user = ctx.from;
    const userLang = user.language_code || config.LANGUAGE || 'en';
    
    // Log command usage
    logger.log({
      type: 'command',
      command: '/start',
      userId: user.id,
      username: user.username || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Update user activity
    await fileHelper.incrementCommandCount(user.id);
    
    // Prepare welcome message
    const firstName = user.first_name || 'User';
    
    const welcomeTitle = getText(userLang, 'welcome.title');
    const welcomeDesc = getText(userLang, 'welcome.description', { name: firstName });
    const welcomeFeatures = getText(userLang, 'welcome.features');
    const getStarted = getText(userLang, 'welcome.get_started');
    
    const message = `${welcomeTitle}\n\n${welcomeDesc}\n\n${welcomeFeatures}\n\n${getStarted}`;
    
    // Create inline keyboard
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(getText(userLang, 'buttons.help'), 'help_command'),
        Markup.button.callback(getText(userLang, 'buttons.support'), 'support_info')
      ],
      [
        Markup.button.url('📱 Add to Group', `https://t.me/${ctx.botInfo.username}?startgroup=true`)
      ]
    ]);
    
    // Send welcome message with inline keyboard
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    });
    
    // Log successful start
    logger.log({
      type: 'user_interaction',
      action: 'start_command_sent',
      userId: user.id,
      username: user.username || 'Unknown',
      language: userLang,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in start command:', error);
    
    // Log error
    logger.log({
      type: 'command_error',
      command: '/start',
      userId: ctx.from?.id,
      username: ctx.from?.username,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Send error message
    const userLang = ctx.from?.language_code || config.LANGUAGE || 'en';
    const errorMsg = getText(userLang, 'errors.general');
    
    await ctx.reply(errorMsg, { parse_mode: 'HTML' });
  }
}

// Handle inline keyboard callbacks
const handleCallbacks = (bot) => {
  // Help callback
  bot.action('help_command', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userLang = ctx.from?.language_code || config.LANGUAGE || 'en';
      
      const helpTitle = getText(userLang, 'help.title');
      const userCommands = getText(userLang, 'help.user_commands');
      const adminCommands = getText(userLang, 'help.admin_commands');
      const support = getText(userLang, 'help.support');
      
      let message = `${helpTitle}\n\n${userCommands}`;
      
      // Show admin commands if user is admin
      const userId = ctx.from.id;
      if (userId === config.OWNER_ID || (config.ADMINS && config.ADMINS.includes(userId))) {
        message += `\n\n${adminCommands}`;
      }
      
      message += `\n\n${support}`;
      
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('← Back', 'back_to_start')]
        ]).reply_markup
      });
      
    } catch (error) {
      console.error('❌ Error in help callback:', error);
    }
  });
  
  // Support callback
  bot.action('support_info', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const userLang = ctx.from?.language_code || config.LANGUAGE || 'en';
      
      const supportMessage = `💬 <b>Support Information</b>\n\n` +
        `If you need help or have questions:\n\n` +
        `• Use /help for available commands\n` +
        `• Report issues to the bot administrator\n` +
        `• Join our support group for updates\n\n` +
        `<i>Bot Version: 1.0.0</i>`;
      
      await ctx.editMessageText(supportMessage, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('← Back', 'back_to_start')]
        ]).reply_markup
      });
      
    } catch (error) {
      console.error('❌ Error in support callback:', error);
    }
  });
  
  // Back to start callback
  bot.action('back_to_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      // Re-execute start command
      await execute(ctx);
      
    } catch (error) {
      console.error('❌ Error in back to start callback:', error);
    }
  });
};

module.exports = {
  name: 'start',
  description: 'Start the bot and show welcome message',
  execute,
  handleCallbacks
};
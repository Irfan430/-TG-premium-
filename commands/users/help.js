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
 * Help command handler
 * @param {Object} ctx - Telegraf context
 */
async function execute(ctx) {
  try {
    const user = ctx.from;
    const userLang = user.language_code || config.LANGUAGE || 'en';
    
    // Log command usage
    logger.log({
      type: 'command',
      command: '/help',
      userId: user.id,
      username: user.username || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Update user activity
    await fileHelper.incrementCommandCount(user.id);
    
    // Get user statistics for admin users
    const isAdmin = user.id === config.OWNER_ID || (config.ADMINS && config.ADMINS.includes(user.id));
    
    // Build help message
    const helpTitle = getText(userLang, 'help.title');
    const userCommands = getText(userLang, 'help.user_commands');
    const adminCommands = getText(userLang, 'help.admin_commands');
    const support = getText(userLang, 'help.support');
    
    let message = `${helpTitle}\n\n${userCommands}`;
    
    // Add admin commands if user is admin
    if (isAdmin) {
      message += `\n\n${adminCommands}`;
      
      // Add bot statistics for admins
      try {
        const stats = await fileHelper.getUserStats();
        const botStats = getText(userLang, 'info.bot_stats', {
          totalUsers: stats.totalUsers,
          activeToday: stats.activeToday,
          activeThisWeek: stats.activeThisWeek
        });
        message += `\n\n${botStats}`;
      } catch (error) {
        console.error('❌ Error getting bot stats:', error);
      }
    }
    
    message += `\n\n${support}`;
    
    // Add additional help information
    message += `\n\n📝 <b>Usage Examples:</b>\n`;
    message += `• <code>/ytmp3 https://youtube.com/watch?v=example</code>\n`;
    message += `• <code>/ytmp4 https://youtu.be/example</code>\n`;
    
    if (isAdmin) {
      message += `• <code>/broadcast Hello everyone!</code>\n`;
      message += `• <code>/shutdown</code> (admin only)\n`;
    }
    
    message += `\n💡 <b>Tips:</b>\n`;
    message += `• Send YouTube links directly for quick downloads\n`;
    message += `• Use /start to see the welcome message\n`;
    message += `• The bot supports multiple languages automatically\n`;
    
    // Send help message
    await ctx.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    // Log successful help
    logger.log({
      type: 'user_interaction',
      action: 'help_command_sent',
      userId: user.id,
      username: user.username || 'Unknown',
      isAdmin: isAdmin,
      language: userLang,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in help command:', error);
    
    // Log error
    logger.log({
      type: 'command_error',
      command: '/help',
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

module.exports = {
  name: 'help',
  description: 'Show bot commands and usage information',
  execute
};
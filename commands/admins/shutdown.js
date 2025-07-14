const fs = require('fs-extra');
const path = require('path');
const config = require('../../config.json');
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
 * Shutdown command handler
 * @param {Object} ctx - Telegraf context
 */
async function execute(ctx) {
  try {
    const user = ctx.from;
    const userLang = user.language_code || config.LANGUAGE || 'en';
    
    // Only owner can shutdown the bot
    if (user.id !== config.OWNER_ID) {
      await ctx.reply(
        '❌ <b>Access Denied</b>\n\n' +
        'Only the bot owner can shutdown the bot.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    // Log shutdown attempt
    logger.log({
      type: 'admin_command',
      command: '/shutdown',
      userId: user.id,
      username: user.username || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Send confirmation message
    const shutdownMsg = getText(userLang, 'success.shutdown_initiated');
    
    const confirmationMessage = `🛑 <b>Bot Shutdown Confirmation</b>\n\n` +
      `Are you sure you want to shutdown the bot?\n\n` +
      `⚠️ <b>Warning:</b> This will stop the bot completely.\n` +
      `You will need to manually restart it.\n\n` +
      `<i>This action cannot be undone remotely.</i>`;
    
    await ctx.reply(confirmationMessage, { parse_mode: 'HTML' });
    
    // Send final shutdown message
    const finalMessage = `🛑 <b>Shutting down bot...</b>\n\n` +
      `${shutdownMsg}\n\n` +
      `📊 <b>Final Statistics:</b>\n` +
      `⏱️ Shutdown Time: ${new Date().toLocaleString()}\n` +
      `👤 Initiated by: ${user.first_name || user.username || 'Unknown'}\n` +
      `🆔 User ID: ${user.id}\n\n` +
      `<i>Bot will stop responding after this message.</i>`;
    
    await ctx.reply(finalMessage, { parse_mode: 'HTML' });
    
    // Log final shutdown
    logger.log({
      type: 'system',
      action: 'bot_shutdown_initiated',
      adminId: user.id,
      adminUsername: user.username || 'Unknown',
      shutdownTime: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
    
    // Give time for the message to be sent
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🛑 Bot shutdown initiated by admin:', user.username || user.id);
    console.log('📊 Shutdown time:', new Date().toLocaleString());
    console.log('👋 Goodbye!');
    
    // Graceful shutdown
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error in shutdown command:', error);
    
    // Log error
    logger.log({
      type: 'admin_command_error',
      command: '/shutdown',
      userId: ctx.from?.id,
      username: ctx.from?.username,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Send error message
    const userLang = ctx.from?.language_code || config.LANGUAGE || 'en';
    const errorMsg = getText(userLang, 'errors.general');
    
    await ctx.reply(
      `${errorMsg}\n\n<b>Shutdown Error:</b> ${error.message}`,
      { parse_mode: 'HTML' }
    );
  }
}

module.exports = {
  name: 'shutdown',
  description: 'Shutdown the bot gracefully (Owner only)',
  usage: '/shutdown',
  adminOnly: true,
  ownerOnly: true,
  execute
};
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
 * Send message to a user with error handling
 * @param {Object} bot - Telegraf bot instance
 * @param {number} userId - User ID to send message to
 * @param {string} message - Message to send
 * @param {Object} options - Send options
 * @returns {Promise<boolean>} Success status
 */
async function sendMessageToUser(bot, userId, message, options = {}) {
  try {
    await bot.telegram.sendMessage(userId, message, options);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send message to user ${userId}:`, error.message);
    
    // Log delivery failure
    logger.log({
      type: 'broadcast_delivery_failed',
      userId: userId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return false;
  }
}

/**
 * Broadcast command handler
 * @param {Object} ctx - Telegraf context
 */
async function execute(ctx) {
  try {
    const user = ctx.from;
    const userLang = user.language_code || config.LANGUAGE || 'en';
    const messageText = ctx.message.text;
    
    // Extract broadcast message from command
    const parts = messageText.split(' ');
    if (parts.length < 2) {
      const errorMsg = getText(userLang, 'errors.missing_parameter', { parameter: 'message' });
      await ctx.reply(errorMsg, { parse_mode: 'HTML' });
      return;
    }
    
    const broadcastMessage = parts.slice(1).join(' ').trim();
    
    if (!broadcastMessage) {
      await ctx.reply('❌ <b>Error:</b> Broadcast message cannot be empty.', { parse_mode: 'HTML' });
      return;
    }
    
    // Log command usage
    logger.log({
      type: 'admin_command',
      command: '/broadcast',
      userId: user.id,
      username: user.username || 'Unknown',
      messageLength: broadcastMessage.length,
      timestamp: new Date().toISOString()
    });
    
    // Get all users
    const users = await fileHelper.getAllUsers();
    const totalUsers = users.length;
    
    if (totalUsers === 0) {
      await ctx.reply('❌ <b>No users found</b>\n\nThere are no users to broadcast to.', { parse_mode: 'HTML' });
      return;
    }
    
    // Confirm broadcast
    const confirmMessage = `📢 <b>Broadcast Confirmation</b>\n\n` +
      `<b>Message:</b>\n<i>${broadcastMessage}</i>\n\n` +
      `<b>Recipients:</b> ${totalUsers} users\n\n` +
      `Are you sure you want to send this broadcast?`;
    
    const statusMessage = await ctx.reply(confirmMessage, { parse_mode: 'HTML' });
    
    // Send another message to start broadcast
    const startMessage = await ctx.reply('⏳ <b>Starting broadcast...</b>', { parse_mode: 'HTML' });
    
    // Start broadcasting
    let successCount = 0;
    let failureCount = 0;
    let processedCount = 0;
    
    const startTime = Date.now();
    
    // Process users in batches to avoid hitting rate limits
    const batchSize = 30; // Telegram allows ~30 messages per second
    const batches = [];
    
    for (let i = 0; i < users.length; i += batchSize) {
      batches.push(users.slice(i, i + batchSize));
    }
    
    // Format broadcast message with timestamp
    const timestamp = new Date().toLocaleString();
    const formattedMessage = `📢 <b>Broadcast Message</b>\n\n${broadcastMessage}\n\n<i>Sent: ${timestamp}</i>`;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Send messages to all users in current batch
      const batchPromises = batch.map(async (targetUser) => {
        const success = await sendMessageToUser(
          ctx.telegram,
          targetUser.id,
          formattedMessage,
          { parse_mode: 'HTML' }
        );
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
        
        processedCount++;
        
        return success;
      });
      
      // Wait for current batch to complete
      await Promise.all(batchPromises);
      
      // Update progress
      const progress = Math.round((processedCount / totalUsers) * 100);
      const progressMessage = `📊 <b>Broadcast Progress</b>\n\n` +
        `✅ Delivered: ${successCount}\n` +
        `❌ Failed: ${failureCount}\n` +
        `📈 Progress: ${progress}% (${processedCount}/${totalUsers})\n\n` +
        `⏱️ Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`;
      
      try {
        await ctx.telegram.editMessageText(
          startMessage.chat.id,
          startMessage.message_id,
          undefined,
          progressMessage,
          { parse_mode: 'HTML' }
        );
      } catch (editError) {
        // Ignore edit errors (message might be too old)
      }
      
      // Wait between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    // Final results
    const completionTime = Math.round((Date.now() - startTime) / 1000);
    const successMsg = getText(userLang, 'success.broadcast_sent', { count: successCount });
    
    const finalMessage = `📢 <b>Broadcast Completed</b>\n\n` +
      `✅ Successfully delivered: ${successCount}\n` +
      `❌ Failed deliveries: ${failureCount}\n` +
      `📊 Success rate: ${Math.round((successCount / totalUsers) * 100)}%\n` +
      `⏱️ Total time: ${completionTime}s\n\n` +
      `${successMsg}`;
    
    await ctx.telegram.editMessageText(
      startMessage.chat.id,
      startMessage.message_id,
      undefined,
      finalMessage,
      { parse_mode: 'HTML' }
    );
    
    // Log broadcast completion
    logger.log({
      type: 'broadcast_completed',
      adminId: user.id,
      adminUsername: user.username || 'Unknown',
      totalUsers: totalUsers,
      successCount: successCount,
      failureCount: failureCount,
      completionTime: completionTime,
      message: broadcastMessage,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in broadcast command:', error);
    
    // Log error
    logger.log({
      type: 'admin_command_error',
      command: '/broadcast',
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
  name: 'broadcast',
  description: 'Send a message to all bot users (Admin only)',
  usage: '/broadcast <message>',
  adminOnly: true,
  execute
};
const config = require('../config.json');
const logger = require('../utils/logger');

/**
 * Middleware to check if user is admin
 * Checks against OWNER_ID and ADMINS array from config.json
 */
async function isAdmin(ctx, next) {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';
    
    // Check if user is owner
    if (userId === config.OWNER_ID) {
      ctx.isOwner = true;
      ctx.isAdmin = true;
      return next();
    }
    
    // Check if user is in admins array
    if (config.ADMINS && config.ADMINS.includes(userId)) {
      ctx.isAdmin = true;
      return next();
    }
    
    // User is not admin, log unauthorized access attempt
    logger.log({
      type: 'unauthorized_access',
      userId: userId,
      username: username,
      command: ctx.message?.text || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Send error message
    await ctx.reply(
      '❌ <b>Access Denied</b>\n\n' +
      'This command is only available to administrators.\n' +
      'If you believe this is an error, please contact the bot owner.',
      { parse_mode: 'HTML' }
    );
    
    return; // Don't call next(), stop execution here
    
  } catch (error) {
    console.error('❌ Error in isAdmin middleware:', error);
    
    // Log the error
    logger.log({
      type: 'middleware_error',
      middleware: 'isAdmin',
      userId: ctx.from?.id,
      username: ctx.from?.username,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Send generic error message
    await ctx.reply(
      '❌ <b>System Error</b>\n\n' +
      'An error occurred while checking permissions. Please try again later.',
      { parse_mode: 'HTML' }
    );
    
    return; // Don't proceed on error
  }
}

module.exports = isAdmin;
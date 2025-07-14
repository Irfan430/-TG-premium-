const config = require('../config.json');
const logger = require('../utils/logger');

// Store user request timestamps
const userRequests = new Map();

/**
 * Flood control middleware to prevent spam
 * Tracks user requests and enforces cooldowns
 */
async function floodControl(ctx, next) {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';
    const now = Date.now();
    
    // Skip flood control for admins and owner
    if (userId === config.OWNER_ID || (config.ADMINS && config.ADMINS.includes(userId))) {
      return next();
    }
    
    // Get flood control settings from config
    const maxRequests = config.FLOOD_CONTROL?.MAX_REQUESTS || 5;
    const timeWindow = config.FLOOD_CONTROL?.TIME_WINDOW || 60000; // 1 minute default
    
    // Get user's request history
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }
    
    const requests = userRequests.get(userId);
    
    // Remove old requests outside the time window
    const validRequests = requests.filter(timestamp => now - timestamp < timeWindow);
    
    // Check if user has exceeded the limit
    if (validRequests.length >= maxRequests) {
      // Calculate remaining cooldown time
      const oldestRequest = Math.min(...validRequests);
      const remainingTime = Math.ceil((timeWindow - (now - oldestRequest)) / 1000);
      
      // Log spam attempt
      logger.log({
        type: 'flood_control_triggered',
        userId: userId,
        username: username,
        requestCount: validRequests.length,
        maxRequests: maxRequests,
        remainingCooldown: remainingTime,
        timestamp: new Date().toISOString()
      });
      
      // Send cooldown message
      await ctx.reply(
        `🚫 <b>Slow down!</b>\n\n` +
        `You're sending messages too quickly.\n` +
        `Please wait <b>${remainingTime} seconds</b> before trying again.\n\n` +
        `<i>Limit: ${maxRequests} messages per ${timeWindow / 1000} seconds</i>`,
        { parse_mode: 'HTML' }
      );
      
      return; // Don't proceed to next middleware
    }
    
    // Add current request timestamp
    validRequests.push(now);
    userRequests.set(userId, validRequests);
    
    // Proceed to next middleware
    return next();
    
  } catch (error) {
    console.error('❌ Error in floodControl middleware:', error);
    
    // Log the error
    logger.log({
      type: 'middleware_error',
      middleware: 'floodControl',
      userId: ctx.from?.id,
      username: ctx.from?.username,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // On error, allow the request to proceed (fail-safe approach)
    return next();
  }
}

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const timeWindow = config.FLOOD_CONTROL?.TIME_WINDOW || 60000;
  
  for (const [userId, requests] of userRequests.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < timeWindow);
    
    if (validRequests.length === 0) {
      userRequests.delete(userId);
    } else {
      userRequests.set(userId, validRequests);
    }
  }
}, 300000); // Clean up every 5 minutes

module.exports = floodControl;
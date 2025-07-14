const fs = require('fs-extra');
const path = require('path');

const LOGS_FILE = path.join(__dirname, '..', 'data', 'logs.json');

/**
 * Logger utility for command usage and system events
 * Writes logs to /data/logs.json
 */
class Logger {
  constructor() {
    this.maxLogsPerFile = 10000; // Prevent file from growing too large
    this.initializeLogFile();
  }

  /**
   * Initialize the log file if it doesn't exist
   */
  async initializeLogFile() {
    try {
      const dataDir = path.dirname(LOGS_FILE);
      await fs.ensureDir(dataDir);
      
      if (!await fs.pathExists(LOGS_FILE)) {
        await fs.writeJSON(LOGS_FILE, []);
      }
    } catch (error) {
      console.error('❌ Error initializing log file:', error);
    }
  }

  /**
   * Add a log entry
   * @param {Object} logData - The log data to write
   */
  async log(logData) {
    try {
      // Ensure the log file exists
      await this.initializeLogFile();
      
      // Read existing logs
      let logs = [];
      try {
        logs = await fs.readJSON(LOGS_FILE);
      } catch (error) {
        // If file is corrupted, start fresh
        console.warn('⚠️ Log file corrupted, starting fresh');
        logs = [];
      }
      
      // Ensure logs is an array
      if (!Array.isArray(logs)) {
        logs = [];
      }
      
      // Add timestamp if not provided
      if (!logData.timestamp) {
        logData.timestamp = new Date().toISOString();
      }
      
      // Add new log entry
      logs.push(logData);
      
      // Trim logs if exceeding max size
      if (logs.length > this.maxLogsPerFile) {
        logs = logs.slice(-this.maxLogsPerFile); // Keep only the last N logs
      }
      
      // Write back to file
      await fs.writeJSON(LOGS_FILE, logs, { spaces: 2 });
      
    } catch (error) {
      console.error('❌ Error writing to log file:', error);
      // Don't throw error - logging should not break the bot
    }
  }

  /**
   * Get recent logs
   * @param {number} limit - Number of recent logs to return
   * @param {string} type - Filter by log type (optional)
   * @returns {Array} Array of log entries
   */
  async getRecentLogs(limit = 100, type = null) {
    try {
      await this.initializeLogFile();
      
      let logs = await fs.readJSON(LOGS_FILE);
      
      if (!Array.isArray(logs)) {
        return [];
      }
      
      // Filter by type if specified
      if (type) {
        logs = logs.filter(log => log.type === type);
      }
      
      // Sort by timestamp (newest first) and limit
      return logs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
        
    } catch (error) {
      console.error('❌ Error reading log file:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   * @returns {Object} Statistics about logs
   */
  async getStats() {
    try {
      const logs = await fs.readJSON(LOGS_FILE);
      
      if (!Array.isArray(logs)) {
        return { totalLogs: 0, types: {} };
      }
      
      const stats = {
        totalLogs: logs.length,
        types: {},
        today: 0,
        thisWeek: 0
      };
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (6 * 24 * 60 * 60 * 1000));
      
      logs.forEach(log => {
        // Count by type
        stats.types[log.type] = (stats.types[log.type] || 0) + 1;
        
        // Count by time period
        const logDate = new Date(log.timestamp);
        if (logDate >= today) {
          stats.today++;
        }
        if (logDate >= thisWeek) {
          stats.thisWeek++;
        }
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting log stats:', error);
      return { totalLogs: 0, types: {} };
    }
  }

  /**
   * Clear old logs (keep only recent ones)
   * @param {number} daysToKeep - Number of days of logs to keep
   */
  async clearOldLogs(daysToKeep = 30) {
    try {
      const logs = await fs.readJSON(LOGS_FILE);
      
      if (!Array.isArray(logs)) {
        return;
      }
      
      const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
      
      const recentLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
      });
      
      await fs.writeJSON(LOGS_FILE, recentLogs, { spaces: 2 });
      
      console.log(`🧹 Cleaned up logs, kept ${recentLogs.length} recent entries`);
      
    } catch (error) {
      console.error('❌ Error clearing old logs:', error);
    }
  }
}

// Export a singleton instance
module.exports = new Logger();
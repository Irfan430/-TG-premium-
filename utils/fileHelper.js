const fs = require('fs-extra');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const DOWNLOADS_DIR = path.join(__dirname, '..', 'public', 'downloads');

/**
 * File helper utility for user management and file operations
 */
class FileHelper {
  constructor() {
    this.initializeFiles();
  }

  /**
   * Initialize required files and directories
   */
  async initializeFiles() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(USERS_FILE);
      await fs.ensureDir(dataDir);
      
      // Initialize users.json if it doesn't exist
      if (!await fs.pathExists(USERS_FILE)) {
        await fs.writeJSON(USERS_FILE, []);
      }
      
      // Ensure downloads directory exists
      await fs.ensureDir(DOWNLOADS_DIR);
      
    } catch (error) {
      console.error('❌ Error initializing file helper:', error);
    }
  }

  /**
   * Add or update a user in users.json
   * @param {Object} userData - User data to add/update
   */
  async addUser(userData) {
    try {
      await this.initializeFiles();
      
      let users = [];
      try {
        users = await fs.readJSON(USERS_FILE);
      } catch (error) {
        console.warn('⚠️ Users file corrupted, starting fresh');
        users = [];
      }
      
      // Ensure users is an array
      if (!Array.isArray(users)) {
        users = [];
      }
      
      // Check if user already exists
      const existingUserIndex = users.findIndex(user => user.id === userData.id);
      
      if (existingUserIndex !== -1) {
        // Update existing user
        users[existingUserIndex] = {
          ...users[existingUserIndex],
          ...userData,
          last_active: new Date().toISOString()
        };
      } else {
        // Add new user
        const newUser = {
          id: userData.id,
          username: userData.username || 'Unknown',
          first_name: userData.first_name || 'Unknown',
          last_name: userData.last_name || '',
          language_code: userData.language_code || 'en',
          joined_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          command_count: 0,
          ...userData
        };
        users.push(newUser);
      }
      
      // Write back to file
      await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
      
    } catch (error) {
      console.error('❌ Error adding/updating user:', error);
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID to find
   * @returns {Object|null} User object or null if not found
   */
  async getUser(userId) {
    try {
      await this.initializeFiles();
      
      const users = await fs.readJSON(USERS_FILE);
      
      if (!Array.isArray(users)) {
        return null;
      }
      
      return users.find(user => user.id === userId) || null;
      
    } catch (error) {
      console.error('❌ Error getting user:', error);
      return null;
    }
  }

  /**
   * Get all users
   * @returns {Array} Array of all users
   */
  async getAllUsers() {
    try {
      await this.initializeFiles();
      
      const users = await fs.readJSON(USERS_FILE);
      
      if (!Array.isArray(users)) {
        return [];
      }
      
      return users;
      
    } catch (error) {
      console.error('❌ Error getting all users:', error);
      return [];
    }
  }

  /**
   * Update user's last active timestamp
   * @param {number} userId - User ID to update
   */
  async updateUserActivity(userId) {
    try {
      const users = await fs.readJSON(USERS_FILE);
      
      if (!Array.isArray(users)) {
        return;
      }
      
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        users[userIndex].last_active = new Date().toISOString();
        await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
      }
      
    } catch (error) {
      console.error('❌ Error updating user activity:', error);
    }
  }

  /**
   * Increment user's command count
   * @param {number} userId - User ID to update
   */
  async incrementCommandCount(userId) {
    try {
      const users = await fs.readJSON(USERS_FILE);
      
      if (!Array.isArray(users)) {
        return;
      }
      
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        users[userIndex].command_count = (users[userIndex].command_count || 0) + 1;
        users[userIndex].last_active = new Date().toISOString();
        await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
      }
      
    } catch (error) {
      console.error('❌ Error incrementing command count:', error);
    }
  }

  /**
   * Get user statistics
   * @returns {Object} User statistics
   */
  async getUserStats() {
    try {
      const users = await this.getAllUsers();
      
      const stats = {
        totalUsers: users.length,
        activeToday: 0,
        activeThisWeek: 0,
        newToday: 0,
        newThisWeek: 0
      };
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - (6 * 24 * 60 * 60 * 1000));
      
      users.forEach(user => {
        const lastActive = new Date(user.last_active);
        const joinedAt = new Date(user.joined_at);
        
        // Count active users
        if (lastActive >= today) {
          stats.activeToday++;
        }
        if (lastActive >= thisWeek) {
          stats.activeThisWeek++;
        }
        
        // Count new users
        if (joinedAt >= today) {
          stats.newToday++;
        }
        if (joinedAt >= thisWeek) {
          stats.newThisWeek++;
        }
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      return { totalUsers: 0, activeToday: 0, activeThisWeek: 0 };
    }
  }

  /**
   * Clean up old downloaded files
   * @param {number} maxAgeHours - Maximum age in hours for files to keep
   */
  async cleanupDownloads(maxAgeHours = 24) {
    try {
      await fs.ensureDir(DOWNLOADS_DIR);
      
      const files = await fs.readdir(DOWNLOADS_DIR);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old download files`);
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up downloads:', error);
    }
  }

  /**
   * Get download directory path
   * @returns {string} Downloads directory path
   */
  getDownloadsDir() {
    return DOWNLOADS_DIR;
  }

  /**
   * Save file to downloads directory
   * @param {string} filename - Name of the file
   * @param {Buffer} data - File data
   * @returns {string} Full path to saved file
   */
  async saveDownload(filename, data) {
    try {
      await fs.ensureDir(DOWNLOADS_DIR);
      
      const filePath = path.join(DOWNLOADS_DIR, filename);
      await fs.writeFile(filePath, data);
      
      return filePath;
      
    } catch (error) {
      console.error('❌ Error saving download:', error);
      throw error;
    }
  }

  /**
   * Delete a file from downloads directory
   * @param {string} filename - Name of the file to delete
   */
  async deleteDownload(filename) {
    try {
      const filePath = path.join(DOWNLOADS_DIR, filename);
      
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(`🗑️ Deleted download file: ${filename}`);
      }
      
    } catch (error) {
      console.error('❌ Error deleting download:', error);
    }
  }
}

// Export a singleton instance
module.exports = new FileHelper();
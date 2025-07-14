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
 * Validate YouTube URL
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid YouTube URL
 */
function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
}

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null if not found
 */
function extractVideoId(url) {
  const regexPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of regexPatterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Simulate YouTube MP4 download
 * Note: This is a placeholder implementation
 * In production, you would use libraries like:
 * - youtube-dl-exec
 * - ytdl-core
 * - fluent-ffmpeg
 * @param {string} url - YouTube URL
 * @param {string} outputPath - Output file path
 * @returns {Object} Download result
 */
async function downloadYoutubeMp4(url, outputPath) {
  // This is a placeholder implementation
  // In a real application, you would implement actual YouTube downloading
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate download process
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        reject(new Error('Invalid YouTube URL'));
        return;
      }
      
      // Create a dummy MP4 file for demonstration
      const filename = `youtube_${videoId}_${Date.now()}.mp4`;
      const filePath = path.join(outputPath, filename);
      
      // Write a placeholder file
      const dummyContent = `# This is a placeholder MP4 file for YouTube video: ${videoId}\n# In production, this would be the actual video content\n`;
      
      fs.writeFileSync(filePath, dummyContent);
      
      resolve({
        success: true,
        filename: filename,
        filepath: filePath,
        title: `YouTube Video ${videoId}`,
        duration: '5:32',
        filesize: '15.7 MB',
        resolution: '720p'
      });
    }, 5000); // Simulate 5 second download (longer for video)
  });
}

/**
 * YouTube MP4 download command handler
 * @param {Object} ctx - Telegraf context
 */
async function execute(ctx) {
  try {
    const user = ctx.from;
    const userLang = user.language_code || config.LANGUAGE || 'en';
    const messageText = ctx.message.text;
    
    // Extract URL from command
    const parts = messageText.split(' ');
    if (parts.length < 2) {
      const errorMsg = getText(userLang, 'errors.missing_parameter', { parameter: 'YouTube URL' });
      await ctx.reply(errorMsg, { parse_mode: 'HTML' });
      return;
    }
    
    const url = parts.slice(1).join(' ').trim();
    
    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
      const errorMsg = getText(userLang, 'errors.invalid_url');
      await ctx.reply(errorMsg, { parse_mode: 'HTML' });
      return;
    }
    
    // Log command usage
    logger.log({
      type: 'command',
      command: '/ytmp4',
      userId: user.id,
      username: user.username || 'Unknown',
      url: url,
      timestamp: new Date().toISOString()
    });
    
    // Update user activity
    await fileHelper.incrementCommandCount(user.id);
    
    // Send processing message
    const processingMsg = getText(userLang, 'success.download_started');
    const statusMessage = await ctx.reply(processingMsg, { parse_mode: 'HTML' });
    
    try {
      // Start download
      const downloadsDir = fileHelper.getDownloadsDir();
      const result = await downloadYoutubeMp4(url, downloadsDir);
      
      if (result.success) {
        // Send success message
        const successMsg = getText(userLang, 'success.download_complete');
        
        const downloadInfo = `🎬 <b>${result.title}</b>\n` +
          `⏱️ Duration: ${result.duration}\n` +
          `📺 Resolution: ${result.resolution}\n` +
          `📁 Size: ${result.filesize}\n\n` +
          `${successMsg}`;
        
        await ctx.telegram.editMessageText(
          statusMessage.chat.id,
          statusMessage.message_id,
          undefined,
          downloadInfo,
          { parse_mode: 'HTML' }
        );
        
        // Send the video file
        try {
          await ctx.replyWithVideo(
            { source: result.filepath },
            {
              caption: `🎬 ${result.title}\n\n📥 Downloaded via @${ctx.botInfo.username}`,
              supports_streaming: true
            }
          );
          
          // Clean up file after sending
          setTimeout(async () => {
            try {
              await fileHelper.deleteDownload(result.filename);
            } catch (error) {
              console.error('❌ Error deleting file:', error);
            }
          }, 60000); // Delete after 1 minute
          
        } catch (sendError) {
          console.error('❌ Error sending video file:', sendError);
          
          if (sendError.message.includes('file is too big')) {
            const errorMsg = getText(userLang, 'errors.file_too_large');
            await ctx.reply(errorMsg, { parse_mode: 'HTML' });
          } else {
            throw sendError;
          }
        }
        
      } else {
        throw new Error('Download failed');
      }
      
    } catch (downloadError) {
      console.error('❌ Download error:', downloadError);
      
      // Update status message with error
      const errorMsg = getText(userLang, 'errors.download_failed');
      await ctx.telegram.editMessageText(
        statusMessage.chat.id,
        statusMessage.message_id,
        undefined,
        errorMsg,
        { parse_mode: 'HTML' }
      );
    }
    
    // Log successful download
    logger.log({
      type: 'download',
      format: 'mp4',
      userId: user.id,
      username: user.username || 'Unknown',
      url: url,
      success: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in ytmp4 command:', error);
    
    // Log error
    logger.log({
      type: 'command_error',
      command: '/ytmp4',
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
  name: 'ytmp4',
  description: 'Download YouTube video as MP4',
  usage: '/ytmp4 <YouTube URL>',
  execute
};
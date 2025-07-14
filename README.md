# 🤖 Premium Telegram Bot

A feature-rich, production-ready Telegram bot built with Node.js and Telegraf. This bot includes auto command loading, multi-language support, admin features, flood control, and comprehensive logging.

## ✨ Features

- **🔄 Auto Command Loading**: Commands are automatically loaded from `/commands/users` and `/commands/admins` folders
- **🌍 Multi-Language Support**: Built-in support for English, Bengali, and Hindi with easy extensibility
- **👨‍💼 Admin Panel**: Separate admin commands with permission controls
- **🛡️ Flood Control**: Anti-spam protection with configurable cooldowns
- **📊 Comprehensive Logging**: All commands and system events are logged to JSON files
- **💾 JSON-Based Storage**: User data and logs stored in local JSON files (no external database needed)
- **🎵 Media Downloads**: YouTube MP3/MP4 download functionality (placeholder implementation)
- **📢 Broadcast System**: Send messages to all users with progress tracking
- **🔧 Easy Configuration**: Single config file for all bot settings
- **🚀 Production Ready**: Error handling, graceful shutdown, and monitoring

## 📁 Project Structure

```
├── index.js                    # Main bot entry point
├── package.json               # Dependencies and scripts
├── config.json                # Bot configuration
├── .env.example              # Environment variables example
├── README.md                 # This file
├── commands/
│   ├── users/                # User commands (auto-loaded)
│   │   ├── start.js          # Welcome message with inline keyboard
│   │   ├── help.js           # Help and command listing
│   │   └── download_mp3.js   # YouTube MP3 download
│   └── admins/               # Admin commands (auto-loaded)
│       ├── broadcast.js      # Broadcast messages to all users
│       └── shutdown.js       # Graceful bot shutdown
├── middlewares/
│   ├── isAdmin.js           # Admin permission middleware
│   └── floodControl.js      # Anti-spam middleware
├── utils/
│   ├── logger.js            # Logging utility
│   └── fileHelper.js        # File and user management
├── data/
│   ├── users.json           # User database
│   └── logs.json            # Command and system logs
├── lang/
│   ├── en.json              # English language pack
│   ├── bn.json              # Bengali language pack
│   └── hi.json              # Hindi language pack
└── public/
    └── downloads/           # Downloaded media files
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- A Telegram Bot Token (get from [@BotFather](https://t.me/botfather))

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd telegram-bot-premium

# Install dependencies
npm install
```

### 2. Configure the Bot

**Option A: Using config.json (Recommended)**

1. Open `config.json`
2. Replace `YOUR_TELEGRAM_BOT_TOKEN` with your actual bot token
3. Set your `OWNER_ID` (your Telegram user ID)
4. Add admin user IDs to the `ADMINS` array
5. Choose your preferred language

```json
{
  "BOT_TOKEN": "1234567890:ABCDEF-your-actual-bot-token-here",
  "OWNER_ID": 123456789,
  "ADMINS": [123456789, 987654321],
  "LANGUAGE": "en"
}
```

**Option B: Using Environment Variables**

1. Copy `.env.example` to `.env`
2. Set your bot token:

```bash
cp .env.example .env
# Edit .env file with your bot token
```

### 3. Start the Bot

```bash
# Production mode
npm start

# Development mode (with auto-restart)
npm run dev
```

### 4. Verify Installation

1. Open Telegram and find your bot
2. Send `/start` to see the welcome message
3. Send `/help` to see available commands
4. Check console logs for successful startup

## 🔧 Configuration

### Bot Settings (config.json)

| Setting | Description | Default |
|---------|-------------|---------|
| `BOT_TOKEN` | Your Telegram bot token | Required |
| `OWNER_ID` | Bot owner's Telegram user ID | Required |
| `ADMINS` | Array of admin user IDs | `[]` |
| `LANGUAGE` | Default language (en/bn/hi) | `"en"` |
| `FLOOD_CONTROL.MAX_REQUESTS` | Max requests per time window | `5` |
| `FLOOD_CONTROL.TIME_WINDOW` | Time window in milliseconds | `60000` |

### Adding New Languages

1. Create a new JSON file in `/lang/` folder (e.g., `es.json`)
2. Copy the structure from `en.json`
3. Translate all text strings
4. The bot will automatically load the new language

### Adding New Commands

**User Commands:**

1. Create a new `.js` file in `/commands/users/`
2. Export `name` and `execute` function
3. The command will be automatically loaded on restart

**Admin Commands:**

1. Create a new `.js` file in `/commands/admins/`
2. Export `name` and `execute` function
3. Admin middleware will be automatically applied

**Example Command Structure:**

```javascript
module.exports = {
  name: 'mycommand',
  description: 'My custom command',
  async execute(ctx) {
    await ctx.reply('Hello from my command!');
  }
};
```

## 📊 Monitoring and Logs

### Log Types

- **Command Usage**: All user commands
- **System Events**: Bot start/stop, errors
- **Admin Actions**: Broadcasts, shutdowns
- **Security Events**: Unauthorized access attempts
- **User Activity**: New users, last activity

### Log Files

- `data/logs.json`: All system and command logs
- `data/users.json`: User database with activity tracking

### Viewing Logs

Logs are stored in JSON format and can be viewed with any text editor or processed programmatically.

## 🚀 Deployment

### Deploy on Render

1. **Fork this repository**
2. **Create a Render account** at [render.com](https://render.com)
3. **Create a new Web Service**:
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`
4. **Add environment variables**:
   - `BOT_TOKEN`: Your bot token
   - `NODE_ENV`: `production`
5. **Deploy**

### Deploy on Railway

1. **Fork this repository**
2. **Create a Railway account** at [railway.app](https://railway.app)
3. **Create new project** from GitHub repo
4. **Add environment variables**:
   - `BOT_TOKEN`: Your bot token
   - `NODE_ENV`: `production`
5. **Deploy**

### Deploy on Heroku

1. **Fork this repository**
2. **Create a Heroku app**
3. **Connect GitHub repository**
4. **Add environment variables** in Settings > Config Vars:
   - `BOT_TOKEN`: Your bot token
   - `NODE_ENV`: `production`
5. **Deploy from GitHub**

### Deploy on VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Clone and setup your bot
git clone <your-repo-url>
cd telegram-bot-premium
npm install

# Configure your bot (edit config.json)
nano config.json

# Start with PM2
pm2 start index.js --name "telegram-bot"
pm2 startup
pm2 save
```

## 🛠️ Advanced Features

### YouTube Download Integration

To enable real YouTube downloads, install additional packages:

```bash
npm install youtube-dl-exec fluent-ffmpeg
```

Then modify `/commands/users/download_mp3.js` to use actual download libraries instead of the placeholder implementation.

### Database Integration

To switch from JSON files to a database:

1. Install database package (e.g., `mongoose` for MongoDB)
2. Modify `/utils/fileHelper.js` to use database operations
3. Update user and logging functions accordingly

### Custom Middlewares

Add new middlewares in `/middlewares/` folder and apply them in `index.js`:

```javascript
const customMiddleware = require('./middlewares/customMiddleware');
bot.use(customMiddleware);
```

## 📋 Available Commands

### User Commands

- `/start` - Welcome message with inline keyboard
- `/help` - Show all available commands
- `/ytmp3 <URL>` - Download YouTube audio (placeholder)
- `/ytmp4 <URL>` - Download YouTube video (placeholder)

### Admin Commands

- `/broadcast <message>` - Send message to all users
- `/shutdown` - Gracefully shutdown the bot (owner only)

## 🔍 Troubleshooting

### Common Issues

**Bot not responding:**
- Check if bot token is correct in `config.json`
- Verify the bot is running (`npm start`)
- Check console for error messages

**Commands not loading:**
- Ensure command files are in correct folders
- Check that files export `name` and `execute`
- Restart the bot after adding new commands

**Permission errors:**
- Verify your user ID is in `OWNER_ID` or `ADMINS`
- Check that admin middleware is applied correctly

**Language not working:**
- Ensure language code exists in `/lang/` folder
- Check that JSON structure matches `en.json`
- Verify language code in `config.json` is correct

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🆘 Support

- Create an issue for bugs or feature requests
- Join our support community (link in bot)
- Check the troubleshooting section above

## 🔄 Updates

To update the bot:

```bash
git pull origin main
npm install
npm start
```

---

**Made with ❤️ using Node.js and Telegraf**

*This bot template is production-ready and fully extensible. Perfect for building your own Telegram bot with professional features.*
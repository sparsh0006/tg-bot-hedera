# Hedera Telegram Bot

A simple Telegram bot that interacts with the Hedera Agent API.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following content:
   ```
   BOT_TOKEN=your_telegram_bot_token
   API_BASE_URL=http://localhost:3000
   ```
   - Get a bot token from [@BotFather](https://t.me/BotFather) on Telegram
   - Set the API_BASE_URL to your Hedera Agent API endpoint

4. Start the bot:
   ```
   npm start
   ```

## How It Works

1. When the bot starts, it automatically fetches the list of available agents
2. It uses the first agent in the list as the default
3. When a user starts the bot with `/start`, they're automatically connected to this agent
4. The user can immediately send messages to interact with the agent
5. Use `/agents` to see a list of all available agents

## Commands

- `/start` - Show welcome message and available commands
- `/agents` - List all available agents
- `/newagent` - Start a new agent
- Send any text message to chat with your current agent

## Implementation Details

The bot communicates with the Hedera Agent API using the following endpoints:

- GET /agents - Get list of all agents
- POST /:agentId/message - Send a message to an agent # tg-bot-hedera

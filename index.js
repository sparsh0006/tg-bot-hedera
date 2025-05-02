const { Telegraf, Scenes, session } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Hardcoded image URL for greeting
const GREETING_IMAGE_URL = "https://lh3.googleusercontent.com/d/1Lwpt8qWJXhNCvWQE44v6s7sNh2oqIL5v";

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);

// Store user sessions (user_id -> agent_id)
const userSessions = {};
// Default agent ID from agents list
let defaultAgentId = null;
// Track users who have completed the onboarding flow
const completedOnboarding = {};

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = { headers: { 'Content-Type': 'application/json' } };
    
    let response;
    if (method === 'GET') {
      response = await axios.get(url, config);
    } else if (method === 'POST') {
      response = await axios.post(url, data, config);
    }
    
    return response.data;
  } catch (error) {
    console.error(`API Error: ${error.message}`);
    throw error;
  }
}

// Initialize default agent
async function initializeDefaultAgent() {
  try {
    const response = await apiRequest('GET', '/agents');
    if (response && response.agents && response.agents.length > 0) {
      defaultAgentId = response.agents[0].id;
      console.log(`Default agent initialized with ID: ${defaultAgentId}`);
      return true;
    } else {
      console.error('No agents available');
      return false;
    }
  } catch (error) {
    console.error(`Failed to initialize default agent: ${error.message}`);
    return false;
  }
}

// Create scenes for collecting Hedera credentials in the requested order
const accountIdScene = new Scenes.BaseScene('account_id');
accountIdScene.enter((ctx) => ctx.reply('Please enter your Hedera Account Id:'));
accountIdScene.on('text', (ctx) => {
  // Move to next scene without storing
  ctx.scene.enter('public_key');
});

const publicKeyScene = new Scenes.BaseScene('public_key');
publicKeyScene.enter((ctx) => ctx.reply('Please enter your Hedera Public Key:'));
publicKeyScene.on('text', (ctx) => {
  // Move to next scene without storing
  ctx.scene.enter('private_key');
});

const privateKeyScene = new Scenes.BaseScene('private_key');
privateKeyScene.enter((ctx) => ctx.reply('Please enter your Hedera Private Key:'));
privateKeyScene.on('text', (ctx) => {
  // Move to next scene without storing
  ctx.scene.enter('key_type');
});

const keyTypeScene = new Scenes.BaseScene('key_type');
keyTypeScene.enter((ctx) => ctx.reply('Please enter your Hedera Key Type (preferably ECDSA):'));
keyTypeScene.on('text', (ctx) => {
  const userId = ctx.from.id;
  
  // Mark user as completed onboarding
  completedOnboarding[userId] = true;
  
  // Exit wizard and confirm credentials saved
  ctx.scene.leave();
  ctx.reply('Your Hedera credentials have been saved.');
});

// Create stage with all scenes - in the proper order
const stage = new Scenes.Stage([accountIdScene, publicKeyScene, privateKeyScene, keyTypeScene]);

// Register middleware
bot.use(session());
bot.use(stage.middleware());

// Start command
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Always send welcome message first
    if (defaultAgentId) {
      userSessions[userId] = defaultAgentId;
      
      try {
        await ctx.replyWithPhoto(
          { url: GREETING_IMAGE_URL },
          { 
            caption: `Welcome to Hedera Agent Bot! 🤖\n\n` +
              `You're now chatting with an agent (ID: ${defaultAgentId}).\n` +
              `Just send a message to interact with it.`
          }
        );
      } catch (error) {
        console.error(`Error in start command:`, error);
        ctx.reply(`Welcome to Hedera Agent Bot! 🤖\n\n` +
          `You're now chatting with an agent (ID: ${defaultAgentId}).\n` +
          `Just send a message to interact with it.`);
      }
      
      // Check if user already completed onboarding
      if (!completedOnboarding[userId]) {
        // Start the credential collection process
        setTimeout(() => {
          ctx.scene.enter('account_id');
        }, 1000); // Small delay to ensure welcome message is sent first
      }
    } else {
      ctx.reply(`Sorry, no agents are available at the moment.`);
    }
  } catch (error) {
    console.error(`Error in start command:`, error);
    ctx.reply(`Sorry, I couldn't connect to the agent service. Error: ${error.message}`);
  }
});

// List agents command (just for reference)
bot.command('agents', async (ctx) => {
  try {
    const response = await apiRequest('GET', '/agents');
    
    if (response && response.agents && response.agents.length > 0) {
      const agentList = response.agents.map(agent => `- ${agent.id}: ${agent.name || 'Unnamed agent'}`).join('\n');
      ctx.reply(`Available agents:\n${agentList}`);
    } else {
      ctx.reply('No agents available at the moment.');
    }
  } catch (error) {
    ctx.reply(`Failed to fetch agents. Error: ${error.message}`);
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  let agentId = userSessions[userId];
  
  // Check if user has completed onboarding
  if (!completedOnboarding[userId]) {
    return ctx.reply('Please complete the onboarding process first by entering your Hedera credentials.');
  }
  
  // If user doesn't have an agent yet, assign the default
  if (!agentId) {
    if (defaultAgentId) {
      agentId = defaultAgentId;
      userSessions[userId] = defaultAgentId;
    } else {
      return ctx.reply('No agent is available at the moment.');
    }
  }
  
  try {
    // Send message to the agent
    console.log(ctx.message.text);
    const messageData = {
      text: ctx.message.text,
      // Mock credentials would be included here in a real implementation
    };
    
    const response = await apiRequest('POST', `/${agentId}/message`, messageData);

    console.log(response);
    
    // Extract and send agent responses
    if (response && Array.isArray(response)) {
      // Get the latest message from the agent
      const agentMessages = response;
      
      if (agentMessages.length > 0) {
        const latestMessage = agentMessages[agentMessages.length - 1];
        ctx.reply(latestMessage.text);
      } else {
        ctx.reply('No response from the agent.');
      }
    } else {
      ctx.reply('Received an unexpected response format from the agent.');
    }
  } catch (error) {
    ctx.reply(`Failed to communicate with the agent. Error: ${error.message}`);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Bot error: ${err.message}`);
  ctx.reply('An error occurred while processing your request.');
});

// Initialize and start the bot
async function startBot() {
  // Initialize default agent
  await initializeDefaultAgent();
  
  // Start the bot
  bot.launch()
    .then(() => console.log('Bot started successfully!'))
    .catch(err => console.error(`Failed to start bot: ${err.message}`));
}

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
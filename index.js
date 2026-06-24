const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

require("./database")(client);
require("./events/ready")(client);
require("./events/interactionCreate")(client);
require("./events/messageCreate")(client);
require("./report")(client);
require("./events/protectionSystem")(client);
require("./events/statusSystem")(client);
require("./events/cleanSystem")(client);
require("./events/emiireact")(client);
require("./events/channelAccessSystem")(client);
require("./events/commandLogger")(client);
require("./events/birthdaySystem")(client);
require("./events/staffSystem")(client);
require('./events/ticketSystem')(client);

client.login(process.env.TOKEN);

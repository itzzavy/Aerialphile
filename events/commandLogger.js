const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

const LOG_CHANNEL_ID = "1485575354499207258";

// =====================================================
// HELPERS
// =====================================================

function displayName(user) {
  // discord.js v14: `.tag` (Username#0001) is deprecated for migrated
  // accounts, `.username` is the safe modern choice.
  return user?.username ?? user?.tag ?? "Unknown User";
}

// Builds "/command sub" (or "/command group sub") from whatever was invoked.
function getFullCommandName(interaction) {
  let group = null;
  let sub = null;

  try { group = interaction.options.getSubcommandGroup(false); } catch {}
  try { sub = interaction.options.getSubcommand(false); } catch {}

  let name = `/${interaction.commandName}`;
  if (group) name += ` ${group}`;
  if (sub) name += ` ${sub}`;
  return name;
}

// Flattens every option the user actually provided — including options
// buried inside a subcommand/subcommand group — into readable lines.
// Previously only "user" and "role" were captured; anything else (strings,
// numbers, channels, attachments, booleans) was invisible in the log.
function getOptionsText(options) {
  if (!options || options.length === 0) return null;

  const lines = [];

  function walk(opts, prefix) {
    for (const opt of opts) {
      if (
        opt.type === ApplicationCommandOptionType.Subcommand ||
        opt.type === ApplicationCommandOptionType.SubcommandGroup
      ) {
        walk(opt.options || [], `${prefix}${opt.name} `);
        continue;
      }

      let value;
      if (opt.user) value = `${displayName(opt.user)} (${opt.user.id})`;
      else if (opt.role) value = `${opt.role.name} (${opt.role.id})`;
      else if (opt.channel) value = `<#${opt.channel.id}>`;
      else if (opt.attachment) value = opt.attachment.name || opt.attachment.url;
      else value = String(opt.value);

      lines.push(`**${prefix}${opt.name}:** ${value}`);
    }
  }

  walk(options, "");
  if (lines.length === 0) return null;

  const text = lines.join("\n");
  // Embed field values are capped at 1024 chars.
  return text.length > 1024 ? `${text.slice(0, 1000)}\n…(truncated)` : text;
}

module.exports = (client) => {
  // =======================
  // 🔹 COMMAND LOGS
  // =======================
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    try {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (!logChannel) return;

      const user = `${displayName(interaction.user)} (${interaction.user.id})`;
      const command = getFullCommandName(interaction);
      // interaction.channelId is always safe; interaction.channel can be
      // null and throw when accessing .id in edge cases (uncached channel).
      const channel = `<#${interaction.channelId}>`;
      const optionsText = getOptionsText(interaction.options.data);

      const embed = new EmbedBuilder()
        .setTitle("Command Log")
        .setColor(0x3498db)
        .addFields(
          { name: "User", value: user },
          { name: "Command", value: command, inline: true },
          { name: "Channel", value: channel, inline: true }
        )
        .setTimestamp();

      if (optionsText) {
        embed.addFields({ name: "Options", value: optionsText });
      }

      // This listener only observes that the command was invoked — it runs
      // independently of whatever handler actually executes the command, so
      // it has no way to know if that handler succeeded, was blocked by a
      // permission check, or threw. Labeling this "SUCCESS" was misleading;
      // this only confirms the interaction reached Discord and was received.
      embed.addFields({
        name: "Status",
        value: "🔔 Command Invoked",
        inline: true,
      });

      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("commandLogger: failed to log command:", err);
    }
  });

  // =======================
  // 🔹 BOT MESSAGE DELETE (clean system)
  // =======================
  client.on("messageDelete", async (message) => {
    try {
      if (!message.guild) return;
      if (!message.author?.bot) return;

      const data = await client.cleanChannelsDB.findOne({
        guildId: message.guild.id,
        channelId: message.channel.id,
      });

      if (!data) return;

      const channel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle("Bot Message Deleted (Clean System)")
        .setColor(0xe74c3c)
        .addFields(
          { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
          { name: "Bot", value: displayName(message.author), inline: true },
          { name: "Content", value: message.content?.slice(0, 1000) || "None" }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("commandLogger: failed to log bot message deletion:", err);
    }
  });
};
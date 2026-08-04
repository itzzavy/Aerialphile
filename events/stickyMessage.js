const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const STICKY_DELAY_MS = 60 * 1000; // repost after this long with no new activity

module.exports = (client) => {
  // In-memory cache so we don't hit the DB on every single message.
  // channelId -> { message, messageId, guildId }
  const stickyChannels = new Map();
  // channelId -> active setTimeout handle
  const timers = new Map();

  async function loadStickyChannels() {
    try {
      const all = await client.stickyDB.find({}).toArray();
      for (const entry of all) {
        stickyChannels.set(entry.channelId, {
          message: entry.message,
          messageId: entry.messageId || null,
          guildId: entry.guildId,
        });
      }
    } catch (err) {
      console.error("stickyMessage: failed to load sticky channels:", err);
    }
  }

  async function bumpSticky(channelId) {
    const config = stickyChannels.get(channelId);
    if (!config) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    try {
      if (config.messageId) {
        const oldMsg = await channel.messages.fetch(config.messageId).catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(0x87ceeb)
        .setDescription(config.message)
        .setFooter({ text: "📌 Sticky Message" });

      const sent = await channel.send({ embeds: [embed] });

      config.messageId = sent.id;
      stickyChannels.set(channelId, config);

      await client.stickyDB.updateOne(
        { channelId },
        { $set: { messageId: sent.id } }
      );
    } catch (err) {
      console.error(`stickyMessage: failed to bump sticky in channel ${channelId}:`, err);
    }
  }

  function scheduleSticky(channelId) {
    const existing = timers.get(channelId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      timers.delete(channelId);
      bumpSticky(channelId);
    }, STICKY_DELAY_MS);

    timers.set(channelId, timeout);
  }

  client.once("clientReady", async () => {
    await loadStickyChannels();
  });

  // Only genuine new messages (not the bot's own sticky repost) re-arm the
  // idle timer — otherwise a silent channel would bump forever every 60s.
  client.on("messageCreate", (message) => {
    if (message.author.id === client.user.id) return;
    if (!stickyChannels.has(message.channel.id)) return;

    scheduleSticky(message.channel.id);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "setsticky") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "❌ Only administrators can use this command.",
          ephemeral: true,
        });
      }

      const message = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") ?? interaction.channel;

      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: "❌ That channel isn't a text channel I can post in.",
          ephemeral: true,
        });
      }

      try {
        await client.stickyDB.updateOne(
          { channelId: channel.id },
          {
            $set: {
              guildId: interaction.guild.id,
              channelId: channel.id,
              message,
              messageId: null,
            },
          },
          { upsert: true }
        );

        stickyChannels.set(channel.id, {
          message,
          messageId: null,
          guildId: interaction.guild.id,
        });

        await bumpSticky(channel.id);

        return interaction.reply({
          content: `✅ Sticky message set in ${channel}.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("stickyMessage: setsticky error:", err);
        return interaction.reply({
          content: "❌ Failed to set the sticky message.",
          ephemeral: true,
        });
      }
    }

    if (interaction.commandName === "removesticky") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "❌ Only administrators can use this command.",
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel("channel") ?? interaction.channel;

      try {
        const existing = stickyChannels.get(channel.id);

        if (!existing) {
          return interaction.reply({
            content: "❌ There's no sticky message set in that channel.",
            ephemeral: true,
          });
        }

        const timer = timers.get(channel.id);
        if (timer) {
          clearTimeout(timer);
          timers.delete(channel.id);
        }

        if (existing.messageId) {
          const targetChannel = client.channels.cache.get(channel.id);
          const oldMsg = await targetChannel?.messages.fetch(existing.messageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        }

        await client.stickyDB.deleteOne({ channelId: channel.id });
        stickyChannels.delete(channel.id);

        return interaction.reply({
          content: `✅ Sticky message removed from ${channel}.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("stickyMessage: removesticky error:", err);
        return interaction.reply({
          content: "❌ Failed to remove the sticky message.",
          ephemeral: true,
        });
      }
    }
  });
};
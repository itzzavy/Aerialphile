const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

// Only this user can run /exportemojis — not admins, not anyone else.
const OWNER_ID = "PUT_YOUR_USER_ID_HERE";

module.exports = (client) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "exportemojis") return;

    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const emojis = Array.from(client.emojis.cache.values()).map((emoji) => ({
        name: emoji.name,
        id: emoji.id,
        animated: emoji.animated,
        code: emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`,
        url: emoji.imageURL({ extension: emoji.animated ? "gif" : "png", size: 128 }),
        guildId: emoji.guild?.id ?? null,
        guildName: emoji.guild?.name ?? "Unknown",
      }));

      emojis.sort((a, b) => {
        if (a.guildName !== b.guildName) return a.guildName.localeCompare(b.guildName);
        return a.name.localeCompare(b.name);
      });

      // Per-guild counts, for a quick summary in the reply.
      const perGuild = {};
      for (const e of emojis) {
        perGuild[e.guildName] = (perGuild[e.guildName] || 0) + 1;
      }

      const summaryLines = Object.entries(perGuild)
        .map(([guildName, count]) => `• **${guildName}**: ${count} emoji${count === 1 ? "" : "s"}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("📦 Emoji Export")
        .setColor(0x87ceeb)
        .setDescription(`Exported **${emojis.length}** emoji(s) across **${Object.keys(perGuild).length}** server(s).\n\n${summaryLines}`)
        .setTimestamp();

      const buffer = Buffer.from(JSON.stringify(emojis, null, 2), "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: "emoji-export.json" });

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (err) {
      console.error("emojiExport error:", err);
      await interaction.editReply({
        content: "❌ Failed to export emojis.",
      });
    }
  });
};
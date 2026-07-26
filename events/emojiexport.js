const { EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");

module.exports = (client) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "exportemojis") return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Only administrators can use this command.",
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
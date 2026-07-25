const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
} = require("discord.js");

const MAX_MSGS = 1000;

// Put the role ID that (besides Administrators) is allowed to run this command.
const ALLOWED_ROLE_ID = "1479882366863282389";

const PAGE_CSS = `
body { background: #2b2d31; color: #d3d6db; font-family: Helvetica, Arial, sans-serif; padding: 18px; }
.row { display: flex; gap: 12px; margin-bottom: 8px; }
.pfp { width: 38px; height: 38px; border-radius: 50%; flex: 0 0 auto; }
.name { font-weight: bold; color: #f2f3f5; }
.time { font-size: 11px; color: #8a8f98; margin-left: 6px; }
.body { white-space: pre-wrap; word-break: break-word; }
.file-link { color: #4fa4e8; display: block; }
`;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function successEmbed(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(`✅ ${text}`);
}

function errorEmbed(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${text}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transcript")
    .setDescription("Generate an HTML transcript of a channel")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to create transcript from (defaults to this channel)")
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread
        )
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of messages (1-1000)")
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [errorEmbed("Run this inside a server text channel.")],
        ephemeral: true,
      });
      return;
    }

    // --- permission check: Administrators OR the configured role ---
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasAllowedRole =
      ALLOWED_ROLE_ID !== "PUT_ROLE_ID_HERE" &&
      interaction.member.roles.cache.has(ALLOWED_ROLE_ID);

    if (!isAdmin && !hasAllowedRole) {
      await interaction.reply({
        embeds: [errorEmbed("You don't have permission to use this command.")],
        ephemeral: true,
      });
      return;
    }

    // --- resolve target channel (defaults to the channel the command was run in) ---
    const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({
        embeds: [errorEmbed("That channel isn't a text channel I can read.")],
        ephemeral: true,
      });
      return;
    }

    const botPerms = targetChannel.permissionsFor(interaction.client.user);
    if (
      !botPerms ||
      !botPerms.has(PermissionFlagsBits.ViewChannel) ||
      !botPerms.has(PermissionFlagsBits.ReadMessageHistory)
    ) {
      await interaction.reply({
        embeds: [errorEmbed(`I don't have permission to read message history in ${targetChannel}.`)],
        ephemeral: true,
      });
      return;
    }

    let limit = interaction.options.getInteger("limit") ?? MAX_MSGS;
    if (limit > MAX_MSGS) limit = MAX_MSGS;
    if (limit < 1) limit = 1;

    await interaction.deferReply();

    let messages;
    try {
      const fetched = await targetChannel.messages.fetch({ limit });
      messages = Array.from(fetched.values()).reverse();
    } catch (err) {
      await interaction.editReply({
        embeds: [errorEmbed("Failed to fetch messages from that channel.")],
      });
      return;
    }

    const bodyHtml = messages
      .map((msg) => {
        const name = escapeHtml(msg.member?.displayName ?? msg.author.username);
        const avatar = msg.author.displayAvatarURL({ extension: "png", size: 64 });
        const stamp =
          new Date(msg.createdTimestamp).toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "UTC",
          }) + " UTC";
        const text = msg.content ? escapeHtml(msg.content) : "";

        let files = "";
        for (const att of msg.attachments.values()) {
          files += `<a class="file-link" href="${escapeHtml(att.url)}">${escapeHtml(att.name)}</a>`;
        }

        return (
          `<div class="row"><img class="pfp" src="${avatar}">` +
          `<div><span class="name">${name}</span><span class="time">${stamp}</span>` +
          `<div class="body">${text}</div>${files}</div></div>`
        );
      })
      .join("");

    const page =
      `<html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head>` +
      `<body><h3>#${escapeHtml(targetChannel.name)} transcript (${messages.length} messages)</h3>` +
      bodyHtml +
      `</body></html>`;

    const buffer = Buffer.from(page, "utf-8");
    const attachment = new AttachmentBuilder(buffer, {
      name: `${targetChannel.name}-transcript.html`,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(`Pulled ${messages.length} message(s) from ${targetChannel}.`),
      ],
      files: [attachment],
    });
  },
};
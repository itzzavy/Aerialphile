const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// =====================================================
// CONFIG
// =====================================================

// Roles (besides Administrators) allowed to view staff stats/leaderboard/etc.
const STAFF_VIEW_WHITELIST_ROLES = [
  "1525090493732749432", // staff activity access
];

// Category → visual identity. Add more categories here and everything
// (embeds, colors, emojis) picks it up automatically.
const CATEGORY_META = {
  Management: { emoji: "👑", color: 0xffd700 },
  Moderators: { emoji: "🛡️", color: 0x5865f2 },
  Staff: { emoji: "✨", color: 0x57f287 },
};
const DEFAULT_META = { emoji: "📌", color: 0x0b3d91 };

function meta(category) {
  return CATEGORY_META[category] || DEFAULT_META;
}

// Activity thresholds, in ms.
const ACTIVE_WINDOW = 86400000; // 24h
const SEMI_ACTIVE_WINDOW = 604800000; // 7d

// =====================================================
// HELPERS
// =====================================================

function displayName(user) {
  // discord.js v14: `.tag` (Username#0001) is deprecated for migrated
  // accounts, `.username` is the safe modern choice.
  return user.username ?? user.tag ?? "Unknown User";
}

function relTime(date) {
  if (!date) return "Never";
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;
}

function fullTime(date) {
  if (!date) return "Unknown";
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:F>`;
}

function activityStatus(lastActiveAt) {
  if (!lastActiveAt) return { emoji: "⚫", label: "No Activity" };
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  if (diff < ACTIVE_WINDOW) return { emoji: "🟢", label: "Active" };
  if (diff < SEMI_ACTIVE_WINDOW) return { emoji: "🟡", label: "Semi Active" };
  return { emoji: "🔴", label: "Inactive" };
}

function progressBar(value, max, size = 10) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const filled = Math.round((clamped / safeMax) * size);
  return "▰".repeat(filled) + "▱".repeat(size - filled);
}

function rankBadge(position) {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `#${position}`;
}

function baseEmbed(guild) {
  return new EmbedBuilder()
    .setColor(DEFAULT_META.color)
    .setFooter({
      text: guild.name,
      iconURL: guild.iconURL({ extension: "png" }) ?? undefined,
    })
    .setTimestamp();
}

function errorReply(text) {
  return {
    embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${text}`)],
    ephemeral: true,
  };
}

async function getAllStaff(client, guildId) {
  return client.staffDB.find({ guildId }).toArray();
}

async function getRankOf(client, guildId, userId) {
  const all = await getAllStaff(client, guildId);
  const sorted = all.sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0));
  const index = sorted.findIndex((s) => s.userId === userId);
  const maxScore = sorted.length ? sorted[0].activityScore || 0 : 0;
  return {
    rank: index === -1 ? null : index + 1,
    total: sorted.length,
    maxScore,
  };
}

// =====================================================
// LEADERBOARD PAGE BUILDER (used by pagination buttons too)
// =====================================================

const LEADERBOARD_PAGE_SIZE = 10;

function buildLeaderboardEmbed(guild, sorted, page, category) {
  const totalPages = Math.max(1, Math.ceil(sorted.length / LEADERBOARD_PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * LEADERBOARD_PAGE_SIZE;
  const pageItems = sorted.slice(start, start + LEADERBOARD_PAGE_SIZE);

  const description = pageItems.length
    ? pageItems
        .map((s, i) => {
          const globalRank = start + i + 1;
          const badge = rankBadge(globalRank);
          const cat = meta(s.category);
          return `${badge} <@${s.userId}>\n${cat.emoji} ${s.category} • **${s.activityScore || 0}** pts • ${relTime(
            s.lastActiveAt
          )}`;
        })
        .join("\n\n")
    : "No staff members found.";

  const embed = baseEmbed(guild)
    .setTitle("🏆 Staff Leaderboard")
    .setColor(0xffd700)
    .setDescription(description)
    .setFooter({
      text: `${guild.name} • Page ${clampedPage + 1}/${totalPages} • ${sorted.length} staff${
        category !== "all" ? ` • Filter: ${category}` : ""
      }`,
      iconURL: guild.iconURL({ extension: "png" }) ?? undefined,
    });

  return { embed, clampedPage, totalPages };
}

function buildLeaderboardRow(page, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staffboard_prev")
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page <= 0),
    new ButtonBuilder()
      .setCustomId("staffboard_next")
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= totalPages - 1)
  );
}

// =====================================================
// MAIN EXPORT
// =====================================================

module.exports = (client) => {
  // =========================
  // MESSAGE TRACKING
  // =========================

  client.on("messageCreate", async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    try {
      const staff = await client.staffDB.findOne({
        guildId: message.guild.id,
        userId: message.author.id,
      });

      if (!staff) return;

      await client.staffDB.updateOne(
        { guildId: message.guild.id, userId: message.author.id },
        {
          $inc: { messagesSent: 1, activityScore: 1 },
          $set: { lastMessageAt: new Date(), lastActiveAt: new Date() },
        }
      );
    } catch (err) {
      console.error("staffSystem messageCreate error:", err);
    }
  });

  // =========================
  // SLASH COMMANDS
  // =========================

  client.on("interactionCreate", async (interaction) => {
    // --- Leaderboard pagination buttons ---
    if (interaction.isButton() && (interaction.customId === "staffboard_prev" || interaction.customId === "staffboard_next")) {
      try {
        const message = interaction.message;
        const currentPage = message.embeds[0]?.footer?.text?.match(/Page (\d+)\//);
        const parsedPage = currentPage ? Number(currentPage[1]) - 1 : 0;
        const categoryMatch = message.embeds[0]?.footer?.text?.match(/Filter: (\w+)/);
        const category = categoryMatch ? categoryMatch[1] : "all";

        const query = { guildId: interaction.guild.id };
        if (category !== "all") query.category = category;

        const staff = await getAllStaff(client, interaction.guild.id).then((all) =>
          category !== "all" ? all.filter((s) => s.category === category) : all
        );
        const sorted = staff.sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0));

        const nextPage = interaction.customId === "staffboard_next" ? parsedPage + 1 : parsedPage - 1;
        const { embed, clampedPage, totalPages } = buildLeaderboardEmbed(interaction.guild, sorted, nextPage, category);

        await interaction.update({
          embeds: [embed],
          components: [buildLeaderboardRow(clampedPage, totalPages)],
        });
      } catch (err) {
        console.error("staffSystem leaderboard pagination error:", err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const commands = [
      "addstaff",
      "removestaff",
      "stafflist",
      "staffstats",
      "staffprofile",
      "staffactivity",
      "staffleaderboard",
    ];

    if (!commands.includes(interaction.commandName)) return;

    // =========================
    // PERMISSION CHECKS
    // =========================

    const adminOnly = ["addstaff", "removestaff"];
    const whitelistOnly = ["staffactivity", "staffleaderboard", "stafflist", "staffstats", "staffprofile"];

    if (adminOnly.includes(interaction.commandName)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply(errorReply("Only administrators can use this command."));
      }
    }

    if (whitelistOnly.includes(interaction.commandName)) {
      const hasRole = STAFF_VIEW_WHITELIST_ROLES.some((roleId) => interaction.member.roles.cache.has(roleId));

      if (!hasRole && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply(errorReply("You don't have permission to use this command."));
      }
    }

    try {
      // =========================
      // ADD STAFF
      // =========================

      if (interaction.commandName === "addstaff") {
        const user = interaction.options.getUser("user");
        const category = interaction.options.getString("category");

        const existing = await client.staffDB.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (existing) {
          return interaction.reply(
            errorReply(`**${displayName(user)}** is already registered as staff (${meta(existing.category).emoji} ${existing.category}).`)
          );
        }

        await client.staffDB.insertOne({
          guildId: interaction.guild.id,
          userId: user.id,
          username: displayName(user),
          category,
          addedBy: interaction.user.id,
          joinedAt: new Date(),
          messagesSent: 0,
          warningsIssued: 0,
          activityScore: 0,
          lastMessageAt: null,
          lastActiveAt: null,
        });

        const catMeta = meta(category);
        const embed = baseEmbed(interaction.guild)
          .setTitle("✅ Staff Member Added")
          .setColor(catMeta.color)
          .setThumbnail(user.displayAvatarURL())
          .setDescription(`${catMeta.emoji} **${displayName(user)}** has joined **${category}**!`)
          .addFields(
            { name: "Added By", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Joined", value: fullTime(new Date()), inline: true }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // =========================
      // REMOVE STAFF (with confirm/cancel buttons)
      // =========================

      if (interaction.commandName === "removestaff") {
        const user = interaction.options.getUser("user");

        const staff = await client.staffDB.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (!staff) {
          return interaction.reply(errorReply("Staff member not found."));
        }

        const catMeta = meta(staff.category);
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("⚠️ Confirm Staff Removal")
          .setDescription(
            `Remove **${displayName(user)}** from ${catMeta.emoji} **${staff.category}**?\nThis will permanently delete their staff record (messages sent, activity score, etc.).`
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("staffremove_confirm").setLabel("Remove").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("staffremove_cancel").setLabel("Cancel").setEmoji("✖️").setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.reply({
          embeds: [confirmEmbed],
          components: [row],
          ephemeral: true,
          fetchReply: true,
        });

        const collector = reply.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          time: 15000,
          max: 1,
        });

        collector.on("collect", async (i) => {
          if (i.customId === "staffremove_confirm") {
            await client.staffDB.deleteOne({
              guildId: interaction.guild.id,
              userId: user.id,
            });

            const doneEmbed = new EmbedBuilder()
              .setColor(0x57f287)
              .setDescription(`✅ Removed **${displayName(user)}** from staff.`);

            await i.update({ embeds: [doneEmbed], components: [] });
          } else {
            const cancelEmbed = new EmbedBuilder().setColor(0x949ba4).setDescription("✖️ Removal cancelled.");
            await i.update({ embeds: [cancelEmbed], components: [] });
          }
        });

        collector.on("end", async (collected) => {
          if (collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
              .setColor(0x949ba4)
              .setDescription("⌛ Confirmation timed out — no changes made.");
            await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
          }
        });

        return;
      }

      // =========================
      // STAFF LIST
      // =========================

      if (interaction.commandName === "stafflist") {
        const staff = await getAllStaff(client, interaction.guild.id);

        const categories = Object.keys(CATEGORY_META);
        const fields = categories.map((cat) => {
          const members = staff.filter((x) => x.category === cat);
          const list = members.map((x) => `• <@${x.userId}>`).join("\n") || "None";
          return {
            name: `${meta(cat).emoji} ${cat} (${members.length})`,
            value: list,
          };
        });

        const embed = baseEmbed(interaction.guild)
          .setTitle("📋 Infinity Staff Team")
          .setColor(0x0b3d91)
          .setThumbnail(interaction.guild.iconURL({ extension: "png" }) ?? null)
          .addFields(fields)
          .setDescription(`**${staff.length}** total staff members. Use \`/staffstats\` or \`/staffprofile\` for details.`);

        return interaction.reply({ embeds: [embed] });
      }

      // =========================
      // STAFF STATS
      // =========================

      if (interaction.commandName === "staffstats") {
        const user = interaction.options.getUser("user") || interaction.user;

        const staff = await client.staffDB.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (!staff) {
          return interaction.reply(errorReply("Staff member not found."));
        }

        const { rank, total, maxScore } = await getRankOf(client, interaction.guild.id, user.id);
        const status = activityStatus(staff.lastActiveAt);
        const catMeta = meta(staff.category);
        const bar = progressBar(staff.activityScore || 0, maxScore || 1);

        const embed = baseEmbed(interaction.guild)
          .setTitle(`📊 ${displayName(user)}`)
          .setColor(catMeta.color)
          .addFields(
            { name: "Category", value: `${catMeta.emoji} ${staff.category}`, inline: true },
            { name: "Status", value: `${status.emoji} ${status.label}`, inline: true },
            { name: "Rank", value: rank ? `${rankBadge(rank)} of ${total}` : "Unranked", inline: true },
            { name: "Messages", value: String(staff.messagesSent || 0), inline: true },
            { name: "Activity Score", value: `${staff.activityScore || 0}\n${bar}`, inline: true },
            { name: "Last Active", value: relTime(staff.lastActiveAt), inline: true },
            { name: "Joined Staff", value: fullTime(staff.joinedAt) }
          );

        return interaction.reply({ embeds: [embed] });
      }

      // =========================
      // STAFF PROFILE
      // =========================

      if (interaction.commandName === "staffprofile") {
        const user = interaction.options.getUser("user") || interaction.user;

        const staff = await client.staffDB.findOne({
          guildId: interaction.guild.id,
          userId: user.id,
        });

        if (!staff) {
          return interaction.reply(errorReply("Staff member not found."));
        }

        const { rank, total, maxScore } = await getRankOf(client, interaction.guild.id, user.id);
        const status = activityStatus(staff.lastActiveAt);
        const catMeta = meta(staff.category);
        const bar = progressBar(staff.activityScore || 0, maxScore || 1);
        const daysAsStaff = Math.max(1, Math.floor((Date.now() - new Date(staff.joinedAt).getTime()) / 86400000));
        const avgPerDay = ((staff.messagesSent || 0) / daysAsStaff).toFixed(1);

        const embed = baseEmbed(interaction.guild)
          .setTitle(`👤 ${displayName(user)}`)
          .setThumbnail(user.displayAvatarURL())
          .setColor(catMeta.color)
          .addFields(
            { name: "Category", value: `${catMeta.emoji} ${staff.category}`, inline: true },
            { name: "Status", value: `${status.emoji} ${status.label}`, inline: true },
            { name: "Rank", value: rank ? `${rankBadge(rank)} of ${total}` : "Unranked", inline: true },
            { name: "Messages Sent", value: String(staff.messagesSent || 0), inline: true },
            { name: "Avg / Day", value: `${avgPerDay} msgs`, inline: true },
            { name: "Warnings Issued", value: String(staff.warningsIssued || 0), inline: true },
            { name: "Activity Score", value: `${staff.activityScore || 0}\n${bar}` },
            { name: "Last Message", value: relTime(staff.lastMessageAt), inline: true },
            { name: "Last Active", value: relTime(staff.lastActiveAt), inline: true },
            { name: "Joined Staff", value: fullTime(staff.joinedAt) }
          );

        return interaction.reply({ embeds: [embed] });
      }

      // =========================
      // STAFF ACTIVITY
      // =========================

      if (interaction.commandName === "staffactivity") {
        const staff = await getAllStaff(client, interaction.guild.id);

        const active = [];
        const semi = [];
        const inactive = [];

        for (const s of staff) {
          const status = activityStatus(s.lastActiveAt);
          const line = `• <@${s.userId}> ${meta(s.category).emoji}`;
          if (status.label === "Active") active.push(line);
          else if (status.label === "Semi Active") semi.push(line);
          else inactive.push(line);
        }

        const total = staff.length || 1;
        const embed = baseEmbed(interaction.guild)
          .setTitle("📈 Staff Activity Overview")
          .setColor(0x0b3d91)
          .setDescription(
            `🟢 **${active.length}** active • 🟡 **${semi.length}** semi-active • 🔴 **${inactive.length}** inactive\n` +
              progressBar(active.length, total, 20)
          )
          .addFields(
            { name: `🟢 Active (${active.length})`, value: active.join("\n") || "None" },
            { name: `🟡 Semi Active (${semi.length})`, value: semi.join("\n") || "None" },
            { name: `🔴 Inactive (${inactive.length})`, value: inactive.join("\n") || "None" }
          );

        return interaction.reply({ embeds: [embed] });
      }

      // =========================
      // STAFF LEADERBOARD (paginated)
      // =========================

      if (interaction.commandName === "staffleaderboard") {
        const category = interaction.options.getString("category") || "all";

        let all = await getAllStaff(client, interaction.guild.id);
        if (category !== "all") all = all.filter((s) => s.category === category);

        const sorted = all.sort((a, b) => (b.activityScore || 0) - (a.activityScore || 0));
        const { embed, clampedPage, totalPages } = buildLeaderboardEmbed(interaction.guild, sorted, 0, category);

        return interaction.reply({
          embeds: [embed],
          components: totalPages > 1 ? [buildLeaderboardRow(clampedPage, totalPages)] : [],
        });
      }
    } catch (err) {
      console.error(`staffSystem ${interaction.commandName} error:`, err);
      const payload = errorReply("Something went wrong running that command.");
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });
};
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = (client) => {
  const BDAY_CHANNEL_ID = "1467026393010536723";

  // Daily check runs on this schedule. Window (not an exact minute) so a
  // slow tick or brief downtime doesn't cause a missed birthday.
  const TARGET_HOUR = 14;
  const TARGET_MINUTE_START = 30;
  const TARGET_MINUTE_END = 35;
  const CHECK_INTERVAL_MS = 60 * 1000;

  const PAGE_SIZE = 10;

  const monthNames = [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December",
  ];

  const BIRTHDAY_MESSAGES = [
    (mention) => `${mention} It's your special day! Hope it's as amazing as you are! 🎂`,
    (mention) => `Everybody grab a slice of cake — ${mention} is leveling up today! 🎮🎂`,
    (mention) => `${mention} May your day be filled with cake, laughter, and zero notifications from work. 🥳`,
    (mention) => `Happy Birthday ${mention}! Time to celebrate another trip around the sun. 🌞🎉`,
    (mention) => `${mention} just unlocked a new age achievement! 🏆🎂`,
  ];

  const ZODIAC_RANGES = [
    { sign: "Capricorn ♑", from: [12, 22], to: [1, 19] },
    { sign: "Aquarius ♒", from: [1, 20], to: [2, 18] },
    { sign: "Pisces ♓", from: [2, 19], to: [3, 20] },
    { sign: "Aries ♈", from: [3, 21], to: [4, 19] },
    { sign: "Taurus ♉", from: [4, 20], to: [5, 20] },
    { sign: "Gemini ♊", from: [5, 21], to: [6, 20] },
    { sign: "Cancer ♋", from: [6, 21], to: [7, 22] },
    { sign: "Leo ♌", from: [7, 23], to: [8, 22] },
    { sign: "Virgo ♍", from: [8, 23], to: [9, 22] },
    { sign: "Libra ♎", from: [9, 23], to: [10, 22] },
    { sign: "Scorpio ♏", from: [10, 23], to: [11, 21] },
    { sign: "Sagittarius ♐", from: [11, 22], to: [12, 21] },
  ];

  // =====================================================
  // HELPERS
  // =====================================================

  function isValidDate(day, month) {
    if (month < 1 || month > 12) return false;
    if (day < 1) return false;

    const daysInMonth = {
      1: 31, 2: 29, 3: 31, 4: 30,
      5: 31, 6: 30, 7: 31, 8: 31,
      9: 30, 10: 31, 11: 30, 12: 31,
    };

    return day <= daysInMonth[month];
  }

  function getZodiac(day, month) {
    for (const z of ZODIAC_RANGES) {
      const [fromMonth, fromDay] = z.from;
      const [toMonth, toDay] = z.to;
      if (fromMonth === toMonth) {
        if (month === fromMonth && day >= fromDay && day <= toDay) return z.sign;
      } else {
        if ((month === fromMonth && day >= fromDay) || (month === toMonth && day <= toDay)) return z.sign;
      }
    }
    return "Unknown";
  }

  function daysUntilBirthday(day, month) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let next = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day));

    if (next < today) {
      next = new Date(Date.UTC(now.getUTCFullYear() + 1, month - 1, day));
    }

    return Math.round((next - today) / 86400000);
  }

  function errorReply(text) {
    return { content: `❌ ${text}`, ephemeral: true };
  }

  // =====================================================
  // BIRTHDAY LIST — PAGINATION
  // =====================================================

  function buildListEmbed(guild, entries, page) {
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
    const start = clampedPage * PAGE_SIZE;
    const pageItems = entries.slice(start, start + PAGE_SIZE);

    const description = pageItems.length
      ? pageItems
          .map((b) => {
            const badge = b.daysUntil === 0 ? "🎉" : "🎂";
            const when = b.daysUntil === 0 ? "**Today!**" : `in ${b.daysUntil} day${b.daysUntil === 1 ? "" : "s"}`;
            return `${badge} <@${b.userId}> — ${b.day} ${monthNames[b.month - 1]} (${when})`;
          })
          .join("\n")
      : "No birthdays saved in this server.";

    return {
      embed: new EmbedBuilder()
        .setColor("#87CEEB")
        .setTitle("🎉 Birthday List")
        .setDescription(description)
        .setFooter({ text: `Page ${clampedPage + 1}/${totalPages} • ${entries.length} birthdays saved` }),
      clampedPage,
      totalPages,
    };
  }

  function buildListRow(page, totalPages, disabled = false) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("bday_prev")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page <= 0),
      new ButtonBuilder()
        .setCustomId("bday_next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page >= totalPages - 1)
    );
  }

  // =====================================================
  // DAILY BIRTHDAY WISHES
  // =====================================================

  async function checkBirthdays() {
    const now = new Date();
    const todayDay = now.getUTCDate();
    const todayMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const birthdays = await client.birthdayDB
      .find({ day: todayDay, month: todayMonth })
      .toArray();

    for (const bday of birthdays) {
      if (bday.lastWishedYear === currentYear) continue;

      const guild = client.guilds.cache.get(bday.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(BDAY_CHANNEL_ID);
      if (!channel) continue;

      const mention = `<@${bday.userId}>`;
      const text = BIRTHDAY_MESSAGES[Math.floor(Math.random() * BIRTHDAY_MESSAGES.length)](mention);

      const embed = new EmbedBuilder()
        .setColor(0xffc0cb)
        .setTitle("🎂 Happy Birthday! 🎉")
        .setDescription(text)
        .setTimestamp();

      try {
        await channel.send({ content: mention, embeds: [embed] });
        await client.birthdayDB.updateOne({ _id: bday._id }, { $set: { lastWishedYear: currentYear } });
      } catch (err) {
        console.error("Failed to send birthday message:", err);
      }
    }
  }

  // =====================================================
  // SLASH COMMAND HANDLER
  // =====================================================

  client.on("interactionCreate", async (interaction) => {
    // --- birthday list pagination buttons ---
    if (interaction.isButton() && (interaction.customId === "bday_prev" || interaction.customId === "bday_next")) {
      try {
        const footerText = interaction.message.embeds[0]?.footer?.text || "";
        const match = footerText.match(/Page (\d+)\//);
        const currentPage = match ? Number(match[1]) - 1 : 0;
        const nextPage = interaction.customId === "bday_next" ? currentPage + 1 : currentPage - 1;

        const birthdays = await client.birthdayDB.find({ guildId: interaction.guild.id }).toArray();
        const entries = birthdays
          .map((b) => ({ ...b, daysUntil: daysUntilBirthday(b.day, b.month) }))
          .sort((a, b) => a.daysUntil - b.daysUntil);

        const { embed, clampedPage, totalPages } = buildListEmbed(interaction.guild, entries, nextPage);

        await interaction.update({
          embeds: [embed],
          components: [buildListRow(clampedPage, totalPages)],
        });
      } catch (err) {
        console.error("Birthday pagination error:", err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    try {
      // =========================
      // SET BIRTHDAY
      // =========================

      if (interaction.commandName === "setbirthday") {
        const day = interaction.options.getInteger("day");
        const month = interaction.options.getInteger("month");

        if (!isValidDate(day, month)) {
          return interaction.reply(errorReply("Invalid date! Example: April has 30 days."));
        }

        await client.birthdayDB.updateOne(
          { userId: interaction.user.id, guildId: interaction.guild.id },
          { $set: { day, month, lastWishedYear: null } },
          { upsert: true }
        );

        const daysUntil = daysUntilBirthday(day, month);
        const zodiac = getZodiac(day, month);
        const whenLine =
          daysUntil === 0
            ? "🎉 That's today — happy birthday!"
            : `⏳ That's in **${daysUntil}** day${daysUntil === 1 ? "" : "s"}.`;

        const embed = new EmbedBuilder()
          .setColor("#87CEEB")
          .setTitle("🎂 Birthday Saved")
          .setDescription(`**${day} ${monthNames[month - 1]}**\n${zodiac}\n\n${whenLine}`);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // =========================
      // REMOVE BIRTHDAY (self-service)
      // Note: register a matching slash command ("removebirthday", no options)
      // wherever your other commands are registered for this to be reachable.
      // =========================

      if (interaction.commandName === "removebirthday") {
        const existing = await client.birthdayDB.findOne({
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        });

        if (!existing) {
          return interaction.reply(errorReply("You don't have a birthday saved."));
        }

        await client.birthdayDB.deleteOne({
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        });

        return interaction.reply({ content: "🗑️ Your birthday has been removed.", ephemeral: true });
      }

      // =========================
      // SEE BIRTHDAYS (sorted by proximity, paginated)
      // =========================

      if (interaction.commandName === "seebday") {
        const birthdays = await client.birthdayDB.find({ guildId: interaction.guild.id }).toArray();

        if (!birthdays.length) {
          return interaction.reply(errorReply("No birthdays saved in this server."));
        }

        const entries = birthdays
          .map((b) => ({ ...b, daysUntil: daysUntilBirthday(b.day, b.month) }))
          .sort((a, b) => a.daysUntil - b.daysUntil);

        const { embed, clampedPage, totalPages } = buildListEmbed(interaction.guild, entries, 0);

        return interaction.reply({
          embeds: [embed],
          components: totalPages > 1 ? [buildListRow(clampedPage, totalPages)] : [],
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("Birthday System Error:", err);
      const payload = errorReply("An error occurred.");
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  // =====================================================
  // BIRTHDAY CHECK SYSTEM
  // =====================================================

  client.once("ready", async () => {
    console.log("🎂 Birthday system loaded");

    // Catch-up: if the bot was offline during today's window, or just
    // restarted, this makes sure nobody's wish gets skipped for the day.
    try {
      await checkBirthdays();
    } catch (err) {
      console.error("Birthday catch-up check failed:", err);
    }

    setInterval(async () => {
      try {
        const now = new Date();
        const hours = now.getUTCHours();
        const minutes = now.getUTCMinutes();

        if (hours !== TARGET_HOUR || minutes < TARGET_MINUTE_START || minutes >= TARGET_MINUTE_END) return;

        await checkBirthdays();
      } catch (err) {
        console.error("Birthday interval check failed:", err);
      }
    }, CHECK_INTERVAL_MS);
  });
};
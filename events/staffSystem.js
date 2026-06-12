const {
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = (client) => {

    client.on("interactionCreate", async interaction => {

        if (!interaction.isChatInputCommand()) return;

        // ADD STAFF

        if (interaction.commandName === "addstaff") {

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ Administrator only.",
                    ephemeral: true
                });
            }

            const user = interaction.options.getUser("user");
            const category = interaction.options.getString("category");

            const existing = await client.staffDB.findOne({
                guildId: interaction.guild.id,
                userId: user.id
            });

            if (existing) {
                return interaction.reply({
                    content: "❌ User is already staff.",
                    ephemeral: true
                });
            }

            await client.staffDB.insertOne({
                guildId: interaction.guild.id,
                userId: user.id,
                username: user.tag,

                category,

                addedBy: interaction.user.id,
                joinedAt: new Date(),

                warningsIssued: 0,
                messagesSent: 0,
                voiceMinutes: 0
            });

            return interaction.reply({
                content: `✅ Added **${user.tag}** to **${category}**.`,
                ephemeral: true
            });
        }

        // REMOVE STAFF

        if (interaction.commandName === "removestaff") {

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ Administrator only.",
                    ephemeral: true
                });
            }

            const user = interaction.options.getUser("user");

            await client.staffDB.deleteOne({
                guildId: interaction.guild.id,
                userId: user.id
            });

            return interaction.reply({
                content: `✅ Removed **${user.tag}** from staff.`,
                ephemeral: true
            });
        }

        // STAFF LIST

        if (interaction.commandName === "stafflist") {

            const staff = await client.staffDB.find({
                guildId: interaction.guild.id
            }).toArray();

            const management =
                staff
                .filter(x => x.category === "Management")
                .map(x => `• <@${x.userId}>`)
                .join("\n") || "None";

            const moderators =
                staff
                .filter(x => x.category === "Moderators")
                .map(x => `• <@${x.userId}>`)
                .join("\n") || "None";

            const staffTeam =
                staff
                .filter(x => x.category === "Staff")
                .map(x => `• <@${x.userId}>`)
                .join("\n") || "None";

            const embed = new EmbedBuilder()
                .setTitle("📋 Infinity Sky Staff Team")
                .setColor(0x0B3D91)
                .addFields(
                    {
                        name: "👑 Management",
                        value: management
                    },
                    {
                        name: "🛡️ Moderators",
                        value: moderators
                    },
                    {
                        name: "✨ Staff",
                        value: staffTeam
                    }
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // STAFF STATS

        if (interaction.commandName === "staffstats") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            const staff = await client.staffDB.findOne({
                guildId: interaction.guild.id,
                userId: user.id
            });

            if (!staff) {
                return interaction.reply({
                    content: "❌ Staff member not found.",
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${user.tag}`)
                .setColor(0x0B3D91)
                .addFields(
                    {
                        name: "Category",
                        value: staff.category,
                        inline: true
                    },
                    {
                        name: "Messages",
                        value: String(staff.messagesSent || 0),
                        inline: true
                    },
                    {
                        name: "Warnings",
                        value: String(staff.warningsIssued || 0),
                        inline: true
                    }
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // LEADERBOARD

        if (interaction.commandName === "staffleaderboard") {

            const staff = await client.staffDB.find({
                guildId: interaction.guild.id
            }).toArray();

            const sorted =
                staff.sort(
                    (a, b) =>
                    (b.messagesSent || 0) -
                    (a.messagesSent || 0)
                );

            const leaderboard =
                sorted
                .slice(0, 10)
                .map(
                    (s, i) =>
                    `#${i + 1} <@${s.userId}> • ${s.messagesSent || 0} messages`
                )
                .join("\n");

            const embed = new EmbedBuilder()
                .setTitle("🏆 Staff Leaderboard")
                .setColor(0x0B3D91)
                .setDescription(
                    leaderboard || "No staff members found."
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

    });

};

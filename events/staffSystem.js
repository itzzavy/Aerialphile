const {
EmbedBuilder,
PermissionFlagsBits
} = require("discord.js");

module.exports = (client) => {

// =========================
// MESSAGE TRACKING
// =========================

client.on("messageCreate", async (message) => {

    if (!message.guild) return;
    if (message.author.bot) return;

    const staff = await client.staffDB.findOne({
        guildId: message.guild.id,
        userId: message.author.id
    });

    if (!staff) return;

    await client.staffDB.updateOne(
        {
            guildId: message.guild.id,
            userId: message.author.id
        },
        {
            $inc: {
                messagesSent: 1,
                activityScore: 1
            },
            $set: {
                lastMessageAt: new Date(),
                lastActiveAt: new Date()
            }
        }
    );
});

// =========================
// SLASH COMMANDS
// =========================

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isChatInputCommand()) return;

    const commands = [
        "addstaff",
        "removestaff",
        "stafflist",
        "staffstats",
        "staffprofile",
        "staffactivity",
        "staffleaderboard"
    ];

    if (!commands.includes(interaction.commandName)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: "❌ Only administrators can use this command.",
            ephemeral: true
        });
    }

    // =========================
    // ADD STAFF
    // =========================

    if (interaction.commandName === "addstaff") {

        const user = interaction.options.getUser("user");
        const category = interaction.options.getString("category");

        const existing = await client.staffDB.findOne({
            guildId: interaction.guild.id,
            userId: user.id
        });

        if (existing) {
            return interaction.reply({
                content: "❌ This user is already registered as staff.",
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

            messagesSent: 0,
            warningsIssued: 0,

            activityScore: 0,

            lastMessageAt: null,
            lastActiveAt: null
        });

        return interaction.reply({
            content: `✅ Added **${user.tag}** to **${category}**.`,
            ephemeral: true
        });
    }

    // =========================
    // REMOVE STAFF
    // =========================

    if (interaction.commandName === "removestaff") {

        const user = interaction.options.getUser("user");

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

        await client.staffDB.deleteOne({
            guildId: interaction.guild.id,
            userId: user.id
        });

        return interaction.reply({
            content: `✅ Removed **${user.tag}** from staff.`,
            ephemeral: true
        });
    }

    // =========================
    // STAFF LIST
    // =========================

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
            .setTitle("📋 Infinity Staff Team")
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

    // =========================
    // STAFF STATS
    // =========================

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
                    name: "Activity Score",
                    value: String(staff.activityScore || 0),
                    inline: true
                },
                {
                    name: "Last Active",
                    value: staff.lastActiveAt
                        ? `<t:${Math.floor(new Date(staff.lastActiveAt).getTime() / 1000)}:R>`
                        : "Never"
                },
                {
                    name: "Joined Staff",
                    value: `<t:${Math.floor(new Date(staff.joinedAt).getTime() / 1000)}:F>`
                }
            );

        return interaction.reply({
            embeds: [embed]
        });
    }

    // =========================
    // STAFF PROFILE
    // =========================

    if (interaction.commandName === "staffprofile") {

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

        let status = "🔴 Inactive";

        if (staff.lastActiveAt) {

            const diff =
                Date.now() -
                new Date(staff.lastActiveAt).getTime();

            if (diff < 86400000)
                status = "🟢 Active";
            else if (diff < 604800000)
                status = "🟡 Semi Active";
        }

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .setColor(0x0B3D91)
            .addFields(
                {
                    name: "Category",
                    value: staff.category,
                    inline: true
                },
                {
                    name: "Status",
                    value: status,
                    inline: true
                },
                {
                    name: "Messages",
                    value: String(staff.messagesSent || 0),
                    inline: true
                },
                {
                    name: "Activity Score",
                    value: String(staff.activityScore || 0)
                },
                {
                    name: "Last Message",
                    value: staff.lastMessageAt
                        ? `<t:${Math.floor(new Date(staff.lastMessageAt).getTime() / 1000)}:R>`
                        : "Never"
                },
                {
                    name: "Joined Staff",
                    value: `<t:${Math.floor(new Date(staff.joinedAt).getTime() / 1000)}:F>`
                }
            );

        return interaction.reply({
            embeds: [embed]
        });
    }

    // =========================
    // STAFF ACTIVITY
    // =========================

    if (interaction.commandName === "staffactivity") {

        const staff = await client.staffDB.find({
            guildId: interaction.guild.id
        }).toArray();

        const active = [];
        const semi = [];
        const inactive = [];

        for (const s of staff) {

            if (!s.lastActiveAt) {
                inactive.push(`<@${s.userId}>`);
                continue;
            }

            const diff =
                Date.now() -
                new Date(s.lastActiveAt).getTime();

            if (diff < 86400000)
                active.push(`<@${s.userId}>`);

            else if (diff < 604800000)
                semi.push(`<@${s.userId}>`);

            else
                inactive.push(`<@${s.userId}>`);
        }

        const embed = new EmbedBuilder()
            .setTitle("📈 Staff Activity")
            .setColor(0x0B3D91)
            .addFields(
                {
                    name: "🟢 Active",
                    value: active.join("\n") || "None"
                },
                {
                    name: "🟡 Semi Active",
                    value: semi.join("\n") || "None"
                },
                {
                    name: "🔴 Inactive",
                    value: inactive.join("\n") || "None"
                }
            );

        return interaction.reply({
            embeds: [embed]
        });
    }

    // =========================
    // STAFF LEADERBOARD
    // =========================

    if (interaction.commandName === "staffleaderboard") {

        const category =
            interaction.options.getString("category") || "all";

        let query = {
            guildId: interaction.guild.id
        };

        if (category !== "all") {
            query.category = category;
        }

        const staff = await client.staffDB.find(query).toArray();

        const sorted = staff.sort(
            (a, b) =>
                (b.activityScore || 0) -
                (a.activityScore || 0)
        );

        const leaderboard =
            sorted
                .slice(0, 10)
                .map((s, i) => {

                    const lastActive =
                        s.lastActiveAt
                            ? `<t:${Math.floor(new Date(s.lastActiveAt).getTime() / 1000)}:R>`
                            : "Never";

                    return `#${i + 1} <@${s.userId}>

Category: ${s.category}
Score: ${s.activityScore || 0}
Last Active: ${lastActive}`;
})
.join("\n\n");

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


};

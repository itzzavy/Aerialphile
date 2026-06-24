const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField
} = require('discord.js');

module.exports = (client) => {
    if (interaction.isChatInputCommand()) {

    if (interaction.commandName !== 'ticketpanel') return;

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Support Center')
        .setDescription(`
➤ Have questions or need assistance? Open a ticket for:

🎫 General Support
🏆 Giveaway & Reward Claims
🎥 Streamer Support

✅ We're here to help and ensure a fair and enjoyable experience for all participants.
        `);

    const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_menu')
        .setPlaceholder('Make a selection')
        .addOptions(
            {
                label: 'General Support',
                description: 'Ask questions and receive assistance',
                value: 'general',
                emoji: '🎫'
            },
            {
                label: 'Giveaway & Reward Claims',
                description: 'Claim giveaway rewards and prizes',
                value: 'giveaway',
                emoji: '🏆'
            },
            {
                label: 'Streamer Support',
                description: 'Apply for streamer access',
                value: 'streamer',
                emoji: '🎥'
            }
        );

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
        embeds: [embed],
        components: [row]
    });
}

    client.on('interactionCreate', async interaction => {

        if (interaction.isStringSelectMenu()) {

            if (interaction.customId !== 'ticket_menu') return;

            const STAFF_ROLE = '1467028112008286452';
            const CATEGORY_ID = '1468623623592874045';

            let ticketName;
            let ticketType;

            switch (interaction.values[0]) {

                case 'general':
                    ticketName = `support-${interaction.user.username}`;
                    ticketType = 'General Support';
                    break;

                case 'giveaway':
                    ticketName = `claim-${interaction.user.username}`;
                    ticketType = 'Giveaway Claim';
                    break;

                case 'streamer':
                    ticketName = `streamer-${interaction.user.username}`;
                    ticketType = 'Get a Streamer role';
                    break;

                default:
                    return;
            }

            const existing = interaction.guild.channels.cache.find(
                c => c.topic === interaction.user.id
            );

            if (existing) {
                return interaction.reply({
                    content: `❌ You already have an open ticket: ${existing}`,
                    ephemeral: true
                });
            }

            const channel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: CATEGORY_ID,
                topic: interaction.user.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    {
                        id: STAFF_ROLE,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(ticketType)
                .setDescription(
                    `Welcome ${interaction.user}\n\nPlease explain your issue and our team will assist you shortly.`
                );

            await channel.send({
                content: `${interaction.user} <@&${STAFF_ROLE}>`,
                embeds: [embed],
                components: [closeButton]
            });

            await interaction.reply({
                content: `✅ Ticket created: ${channel}`,
                ephemeral: true
            });
        }

        if (interaction.isButton()) {

            if (interaction.customId !== 'close_ticket') return;

            await interaction.reply({
                content: '🔒 Closing ticket in 5 seconds...',
                ephemeral: true
            });

            setTimeout(async () => {
                await interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    });

};

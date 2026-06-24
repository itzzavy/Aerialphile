const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Send ticket panel'),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Support Center')
            .setDescription(`
➤ Have questions or need assistance? Open a ticket for:

🎫 General Support
🏆 Giveaway & Reward Claims
🎥 Streamer

✅ We're here to help and ensure a fair and enjoyable experience for all participants.
            `)
            .setImage('YOUR_BANNER_URL');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('Make a selection')
            .addOptions([
                {
                    label: 'General Support',
                    description: 'Ask questions and receive assistance',
                    value: 'general',
                    emoji: '🎫'
                },
                {
                    label: 'Giveaway & Reward Claims',
                    description: 'Claim rewards and prizes',
                    value: 'giveaway',
                    emoji: '🏆'
                },
                {
                    label: 'Streamer',
                    description: 'Apply for streamer access',
                    value: 'streamer',
                    emoji: '🎥'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};

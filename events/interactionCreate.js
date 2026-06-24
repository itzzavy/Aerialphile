const { EmbedBuilder } = require("discord.js");

module.exports = (client) => {

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;


  if (interaction.commandName === "say") {

    const text = interaction.options.getString("text");

    await interaction.reply({ content: "Message sent.", ephemeral: true });

    interaction.channel.send(text);

  }


  if (interaction.commandName === "roleusers") {

    const role = interaction.options.getRole("role");

    await interaction.guild.members.fetch();

    const members = role.members.map(m => `<@${m.id}>`);

    interaction.reply(`**Users with ${role.name} (${members.length}):**\n${members.join("\n")}`);

  }


  if (interaction.commandName === "addrole") {

    const user = interaction.options.getMember("user");
    const role = interaction.options.getRole("role");

    await user.roles.add(role);

    await interaction.reply({
    content: `**${user.user.username} was given ${role}.**`,
    ephemeral: true
  });

  }


  if (interaction.commandName === "removerole") {

    const user = interaction.options.getMember("user");
    const role = interaction.options.getRole("role");

    await user.roles.remove(role);

    await interaction.reply({
    content: `**${role} removed from ${user.user.username}.**`,
    ephemeral: true
  });
  }


  if (interaction.commandName === "userinfo") {

    const user = interaction.options.getUser("user") || interaction.user;

    const member = await interaction.guild.members.fetch(user.id);

    await interaction.guild.members.fetch();

    const members = interaction.guild.members.cache
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
      .map(m => m.id);

    const rank = members.indexOf(user.id) + 1;

    const roles = member.roles.cache
      .filter(role => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position);

    const roleMentions = roles.map(role => role.toString()).join(" ");

    const topRole = roles.first();

    const embed = new EmbedBuilder()
      .setTitle("User Information")
      .setColor(topRole ? topRole.color : 0x2b2d31)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Username", value: user.tag, inline: true },
        { name: "User ID", value: user.id, inline: true },
        { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>` },
        { name: "Joined Server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` },
        { name: "Server Rank", value: `#${rank}`, inline: true },
        { name: "Top Role", value: topRole ? topRole.toString() : "None", inline: true },
        { name: "Roles", value: roleMentions || "None" },
        { name: "Total Roles", value: roles.size.toString(), inline: true }
      )
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      });

    interaction.reply({ embeds: [embed] });

  }


});

};

const { PermissionsBitField, EmbedBuilder } = require("discord.js");

module.exports = (client) => {

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  if (!message.content.startsWith("!")) return;

  const args = message.content.split(" ");

  const command = args[0].toLowerCase();

  const isAdmin = message.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );


if (command === "!ahelp") {
  if (!isAdmin) return;

  const embed = new EmbedBuilder()
    .setTitle("Infinity Sky Commands")
    .setColor(0x0B3D91)
    .addFields(
      {
        name: " Prefix Commands",
        value:
          "<:Arrow:1490416021851607202> `!cc <name> <response>` → Create custom command\n" +
          "<:Arrow:1490416021851607202> `!ce <name> <new response>` → Edit existing command\n" +
          "<:Arrow:1490416021851607202> `!cd <name>` → Delete custom command\n" +
          "<:Arrow:1490416021851607202> `!cclist` → View all custom commands\n" +
          "<:Arrow:1490416021851607202> `!remindme <time> <text>`"
      },
      {
        name: " Slash Commands (/)",
        value:
          "<:Arrow:1490416021851607202> `/say` → Make the bot say something\n" +
          "<:Arrow:1490416021851607202> `/roleusers` → Show users in a role\n" +
          "<:Arrow:1490416021851607202> `/addrole` → Give role to a user\n" +
          "<:Arrow:1490416021851607202> `/removerole` → Remove role\n" +
          "<:Arrow:1490416021851607202> `/cleanbot` → Auto-delete bot messages in a channel\n" +
          "<:Arrow:1490416021851607202> `/rembot` → Disable auto-clean\n" +
          "<:Arrow:1490416021851607202> `/addch` → Give access (user/role)\n" +
          "<:Arrow:1490416021851607202> `/remch` → Remove access\n" +
          "<:Arrow:1490416021851607202> `/editch` → Edit channel (name/lock)\n" +
          "<:Arrow:1490416021851607202> `/userinfo` → Show user info\n" +
          "<:Arrow:1490416021851607202> `/react` → Auto react to user\n" +
          "<:Arrow:1490416021851607202> `/unreact` → Stop auto reacting"
      }
    );

  await message.channel.send({ embeds: [embed] });
}

  if (command === "!cc") {

    if (!isAdmin) return;

    const name = args[1];

    const response = args.slice(2).join(" ");

    await client.commandsDB.insertOne({ name, response });

    message.channel.send(`**Command !${name} created.**`);

  }


  if (command === "!cd") {

    if (!isAdmin) return;

    const name = args[1];

    await client.commandsDB.deleteOne({ name });

    message.channel.send(`**Command !${name} deleted.**`);

  }


  if (command === "!ce") {

  if (!isAdmin) return;

  const name = args[1];

  const newResponse = args.slice(2).join(" ");

  await client.commandsDB.updateOne(
    { name },
    { $set: { response: newResponse } }
  );

  message.channel.send(`**Command !${name} updated.**`);

}


  if (command === "!cclist") {

    if (!isAdmin) return;    

  const list = await client.commandsDB.find().toArray();

  if (list.length === 0) {
    return message.channel.send("No commands created.");
  }

  const formatted = list.map(c => {
    let preview = c.response || "No response";

    // trim long responses (clean look)
    if (preview.length > 70) preview = preview.slice(0, 70) + "...";

    return `**!${c.name}** ${preview}`;
  });

  const embed = new EmbedBuilder()
    .setTitle("Custom Command List")
    .setColor("#87CEEB") // sky blue
    .setDescription(formatted.join("\n"))
    .setFooter({ text: `Total Commands: ${list.length}` });

  message.channel.send({ embeds: [embed] });

  }


  if (command === "!remindme") {

    const time = args[1];

    const text = args.slice(2).join(" ");

    let ms = 0;

    if (time.endsWith("s")) ms = parseInt(time) * 1000;

    if (time.endsWith("m")) ms = parseInt(time) * 60000;

    if (time.endsWith("h")) ms = parseInt(time) * 3600000;

    if (time.endsWith("d")) ms = parseInt(time) * 86400000;

    message.channel.send(`**Reminder set for ${time}.**`);

    setTimeout(() => {

      message.channel.send(`${message.author} **Reminder:** ${text}`);

    }, ms);

  }


  const name = command.replace("!", "");

  const cmd = await client.commandsDB.findOne({ name });

  if (cmd) message.channel.send(cmd.response);

});

};

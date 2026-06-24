const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = (client) => {

client.once("clientReady", async () => {

  console.log("Infinity Sky is online!");

  client.user.setPresence({
    activities: [{ name: "I'm watching you!!", type: 3 }],
    status: "online"
  });

  const slashCommands = [

    new SlashCommandBuilder()
      .setName("say")
      .setDescription("Make the bot say something")
      .addStringOption(option =>
        option.setName("text").setDescription("Message").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("roleusers")
      .setDescription("Show users in a role")
      .addRoleOption(option =>
        option.setName("role").setDescription("Select role").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("addrole")
      .setDescription("Give role to user")
      .addUserOption(option =>
        option.setName("user").setDescription("User").setRequired(true)
      )
      .addRoleOption(option =>
        option.setName("role").setDescription("Role").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("removerole")
      .setDescription("Remove role from user")
      .addUserOption(option =>
        option.setName("user").setDescription("User").setRequired(true)
      )
      .addRoleOption(option =>
        option.setName("role").setDescription("Role").setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("userinfo")
      .setDescription("Show user information")
      .addUserOption(option =>
        option.setName("user").setDescription("Select user").setRequired(false)
      ),

    new SlashCommandBuilder()
  .setName("protect")
  .setDescription("Protect a user from timeouts")
  .addUserOption(option =>
    option.setName("user").setDescription("User").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("unprotect")
  .setDescription("Remove protection from a user")
  .addUserOption(option =>
    option.setName("user").setDescription("User").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("protectedlist")
  .setDescription("Show protected users")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
  .setName("setstatus")
  .setDescription("Change bot status")
  .addStringOption(option =>
    option.setName("text")
      .setDescription("Status text")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName("type")
      .setDescription("Activity type")
      .setRequired(true)
      .addChoices(
        { name: "Playing", value: "PLAYING" },
        { name: "Watching", value: "WATCHING" },
        { name: "Listening", value: "LISTENING" },
        { name: "Streaming", value: "STREAMING" }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
  .setName("cleanbot")
  .setDescription("Add this channel to auto-clean list")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("rembot")
  .setDescription("Remove this channel from auto-clean list")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("addch")
  .setDescription("Give access to a user or role")
  .addMentionableOption(o =>
    o.setName("target")
      .setDescription("User or Role")
      .setRequired(true)
  )
  .addChannelOption(o =>
    o.setName("channel")
      .setDescription("Channel")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("remch")
  .setDescription("Remove access from a user or role")
  .addMentionableOption(o =>
    o.setName("target")
      .setDescription("User or Role")
      .setRequired(true)
  )
  .addChannelOption(o =>
    o.setName("channel")
      .setDescription("Channel")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
new SlashCommandBuilder()
  .setName("editch")
  .setDescription("Edit channel")
  .addStringOption(o => o.setName("name").setDescription("New name"))
  .addBooleanOption(o => o.setName("lock").setDescription("Lock/unlock"))
  .addChannelOption(o => o.setName("channel").setDescription("Channel")),

    new SlashCommandBuilder()
  .setName("react")
  .setDescription("Auto react to a user's messages")
  .addUserOption(option =>
    option.setName("user").setDescription("User").setRequired(true)
  )
  .addStringOption(option =>
    option.setName("emoji").setDescription("Emoji").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("unreact")
  .setDescription("Stop auto reacting to a user")
  .addUserOption(option =>
    option.setName("user").setDescription("User").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
  .setName("setbirthday")
  .setDescription("Set your birthday")
  .addIntegerOption(option =>
    option.setName("day")
      .setDescription("Day (1-31)")
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName("month")
      .setDescription("Month (1-12)")
      .setRequired(true)
  ), 

new SlashCommandBuilder()
  .setName("seebday")
  .setDescription("View all saved birthdays"),

new SlashCommandBuilder()
.setName("addstaff")
.setDescription("Add a staff member")
.addUserOption(option =>
    option.setName("user")
    .setDescription("Staff member")
    .setRequired(true)
)
.addStringOption(option =>
    option.setName("category")
    .setDescription("Staff category")
    .setRequired(true)
    .addChoices(
        { name: "Management", value: "Management" },
        { name: "Moderators", value: "Moderators" },
        { name: "Staff", value: "Staff" }
    )
)
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("removestaff")
.setDescription("Remove a staff member")
.addUserOption(option =>
    option.setName("user")
    .setDescription("Staff member")
    .setRequired(true)
)
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("stafflist")
.setDescription("View all registered staff")
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("staffstats")
.setDescription("View staff statistics")
.addUserOption(option =>
    option.setName("user")
    .setDescription("Staff member")
    .setRequired(false)
)
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("staffprofile")
.setDescription("View a detailed staff profile")
.addUserOption(option =>
    option.setName("user")
    .setDescription("Staff member")
    .setRequired(false)
)
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("staffactivity")
.setDescription("View staff activity status")
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

new SlashCommandBuilder()
.setName("staffleaderboard")
.setDescription("View the staff activity leaderboard")
.addStringOption(option =>
    option.setName("category")
    .setDescription("Filter by category")
    .setRequired(false)
    .addChoices(
        { name: "All", value: "all" },
        { name: "Management", value: "Management" },
        { name: "Moderators", value: "Moderators" },
        { name: "Staff", value: "Staff" }
    )
)
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send the support ticket panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  await client.application.commands.set(slashCommands);

});

};

const { EmbedBuilder } = require("discord.js");
const { execSync } = require("child_process");
const path = require("path");

// Fill this in with the channel you want update logs posted to.
const UPDATE_LOG_CHANNEL_ID = "1530842795424612493";

// =====================================================
// HELPERS
// =====================================================

// Reads the last commit hash/message/author, if this is running from a git
// checkout. Many hosts (Railway, Render, VPS via git pull) keep the .git
// folder, but some platforms strip it on deploy — this fails safely if so.
function getGitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD").toString().trim();
    const message = execSync("git log -1 --pretty=%B").toString().trim();
    const author = execSync("git log -1 --pretty=%an").toString().trim();
    return { hash, message, author };
  } catch {
    return null;
  }
}

function getPackageVersion() {
  try {
    const pkg = require(path.join(process.cwd(), "package.json"));
    return pkg.version || null;
  } catch {
    return null;
  }
}

module.exports = (client) => {
  client.once("ready", async () => {
    try {
      const git = getGitInfo();
      const version = getPackageVersion();

      // Prefer the commit hash as the "did anything actually change"
      // fingerprint; fall back to package.json version if git isn't
      // available in this environment; if neither exists, we can't tell
      // deploys apart and skip silently rather than spamming every restart.
      const identifier = git?.hash || version;
      if (!identifier) return;

      const stored = await client.updateStateDB.findOne({ key: "lastDeployedIdentifier" });

      if (stored && stored.value === identifier) {
        // Same code as last time the bot came online — just a normal
        // restart, not an update. Don't log it.
        return;
      }

      await client.updateStateDB.updateOne(
        { key: "lastDeployedIdentifier" },
        { $set: { value: identifier, updatedAt: new Date() } },
        { upsert: true }
      );

      const channel = client.channels.cache.get(UPDATE_LOG_CHANNEL_ID);
      if (!channel) {
        console.error("updateLogger: could not find UPDATE_LOG_CHANNEL_ID channel.");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🚀 Bot Updated")
        .setColor(0x87ceeb)
        .setTimestamp();

      const fields = [];
      if (version) fields.push({ name: "Version", value: version, inline: true });
      if (git?.hash) fields.push({ name: "Commit", value: git.hash, inline: true });
      if (git?.author) fields.push({ name: "Author", value: git.author, inline: true });

      // Optional manual note you can set on your host per-deploy
      // (e.g. an env var) for a human-written changelog line, since
      // commit messages aren't always descriptive.
      const manualNote = process.env.UPDATE_NOTE;
      if (manualNote) {
        fields.push({ name: "Notes", value: manualNote.slice(0, 1000) });
      } else if (git?.message) {
        fields.push({ name: "Changes", value: git.message.slice(0, 1000) });
      }

      if (fields.length === 0) {
        fields.push({ name: "Details", value: "No version or commit info available." });
      }

      embed.addFields(fields);

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("updateLogger: ready handler failed:", err);
    }
  });
};
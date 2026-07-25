const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
} = require("discord.js");

// =====================================================
// CONFIG
// =====================================================

const MAX_MESSAGES = 1000;
const DEFAULT_LIMIT = 200;

// Role IDs (besides Administrators) allowed to run this command.
const ALLOWED_ROLE_IDS = [ 
  "1479882366863282389",
];

// =====================================================
// HELPERS
// =====================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimestamp(msLike) {
  return (
    new Date(msLike).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }) + " UTC"
  );
}

function getJumpLink(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function successEmbed(text) {
  return new EmbedBuilder().setColor(0x57f287).setDescription(`✅ ${text}`);
}

function errorEmbed(text) {
  return new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${text}`);
}

// =====================================================
// MARKDOWN / MENTIONS / EMOJI PARSER
// =====================================================
// Mentions and custom emoji are pulled out of the RAW content first (since
// they use literal < > characters that escapeHtml would otherwise mangle),
// replaced with placeholder tokens, then the remaining text is escaped and
// markdown is applied, and finally the placeholders are swapped back in.

function parseContent(raw, guild, client) {
  if (!raw) return "";

  const placeholders = [];
  function stash(html) {
    const token = `\u0000P${placeholders.length}\u0000`;
    placeholders.push(html);
    return token;
  }

  let text = raw;

  // Code blocks first, so nothing inside them gets touched by markdown/mentions.
  text = text.replace(/```(?:\w+\n)?([\s\S]*?)```/g, (m, code) =>
    stash(`<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`)
  );

  // Inline code
  text = text.replace(/`([^`\n]+)`/g, (m, code) =>
    stash(`<code class="inline-code">${escapeHtml(code)}</code>`)
  );

  // Custom / animated emoji <a:name:id> <:name:id>
  text = text.replace(/<(a?):(\w+):(\d+)>/g, (m, animated, name, id) => {
    const ext = animated ? "gif" : "png";
    return stash(
      `<img class="emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${name}:" title=":${name}:" loading="lazy">`
    );
  });

  // User mentions <@id> / <@!id>
  text = text.replace(/<@!?(\d+)>/g, (m, id) => {
    const member = guild?.members.cache.get(id);
    const user = member?.user ?? client.users.cache.get(id);
    const label = user ? `@${user.username}` : "@unknown-user";
    return stash(`<span class="mention mention-user">${escapeHtml(label)}</span>`);
  });

  // Role mentions <@&id>
  text = text.replace(/<@&(\d+)>/g, (m, id) => {
    const role = guild?.roles.cache.get(id);
    const label = role ? `@${role.name}` : "@unknown-role";
    return stash(`<span class="mention mention-role">${escapeHtml(label)}</span>`);
  });

  // Channel mentions <#id>
  text = text.replace(/<#(\d+)>/g, (m, id) => {
    const ch = guild?.channels.cache.get(id);
    const label = ch ? `#${ch.name}` : "#unknown-channel";
    return stash(`<span class="mention mention-channel">${escapeHtml(label)}</span>`);
  });

  // Escape everything that's left over (plain text).
  text = escapeHtml(text);

  // Markdown, order matters: spoilers, bold+italic, bold, underline, strike, italic, blockquote, line breaks.
  text = text.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler">$1</span>');
  text = text.replace(/\*\*\*([\s\S]+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([\s\S]+?)__/g, "<u>$1</u>");
  text = text.replace(/~~([\s\S]+?)~~/g, "<s>$1</s>");
  text = text.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");
  text = text.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, "<em>$1</em>");
  text = text.replace(/^&gt;\s?(.*)$/gm, "<blockquote>$1</blockquote>");
  text = text.replace(/\n/g, "<br>");

  // Restore stashed HTML.
  text = text.replace(/\u0000P(\d+)\u0000/g, (m, idx) => placeholders[Number(idx)]);

  return text;
}

// =====================================================
// ATTACHMENTS / EMBEDS / STICKERS / REPLIES / POLL
// =====================================================

function renderAttachments(attachments) {
  let html = "";
  for (const att of attachments.values()) {
    const type = att.contentType || "";
    if (type.startsWith("image/")) {
      html += `<img class="attachment-image" src="${att.url}" alt="${escapeHtml(att.name)}" loading="lazy">`;
    } else if (type.startsWith("video/")) {
      html += `<video class="attachment-video" controls preload="metadata" src="${att.url}"></video>`;
    } else if (type.startsWith("audio/")) {
      html += `<audio class="attachment-audio" controls src="${att.url}"></audio>`;
    } else {
      const sizeKb = (att.size / 1024).toFixed(1);
      html += `<a class="attachment-file" href="${att.url}" target="_blank">📎 ${escapeHtml(att.name)} (${sizeKb} KB)</a>`;
    }
  }
  return html;
}

function renderEmbeds(embeds, guild, client) {
  if (!embeds || embeds.length === 0) return "";
  return embeds
    .map((embed) => {
      const color = embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#5865F2";
      let html = `<div class="embed" style="border-left-color:${color}">`;

      if (embed.author && embed.author.name) {
        html += `<div class="embed-author">`;
        if (embed.author.iconURL) html += `<img class="embed-author-icon" src="${embed.author.iconURL}">`;
        html += `<span>${escapeHtml(embed.author.name)}</span></div>`;
      }

      if (embed.title) {
        const titleHtml = escapeHtml(embed.title);
        html += embed.url
          ? `<a class="embed-title" href="${embed.url}" target="_blank">${titleHtml}</a>`
          : `<div class="embed-title">${titleHtml}</div>`;
      }

      if (embed.description) {
        html += `<div class="embed-description">${parseContent(embed.description, guild, client)}</div>`;
      }

      if (embed.fields && embed.fields.length) {
        html += `<div class="embed-fields">`;
        for (const field of embed.fields) {
          html += `<div class="embed-field${field.inline ? " inline" : ""}">`;
          html += `<div class="embed-field-name">${escapeHtml(field.name)}</div>`;
          html += `<div class="embed-field-value">${parseContent(field.value, guild, client)}</div></div>`;
        }
        html += `</div>`;
      }

      if (embed.thumbnail) html += `<img class="embed-thumbnail" src="${embed.thumbnail.url}" loading="lazy">`;
      if (embed.image) html += `<img class="embed-image" src="${embed.image.url}" loading="lazy">`;

      if (embed.footer && embed.footer.text) {
        html += `<div class="embed-footer">`;
        if (embed.footer.iconURL) html += `<img class="embed-footer-icon" src="${embed.footer.iconURL}">`;
        html += `<span>${escapeHtml(embed.footer.text)}</span></div>`;
      }

      html += `</div>`;
      return html;
    })
    .join("");
}

function renderStickers(stickers) {
  if (!stickers || stickers.size === 0) return "";
  let html = '<div class="stickers">';
  for (const sticker of stickers.values()) {
    html += `<img class="sticker" src="${sticker.url}" alt="${escapeHtml(sticker.name)}" title="${escapeHtml(sticker.name)}" loading="lazy">`;
  }
  html += "</div>";
  return html;
}

function renderPoll(msg) {
  if (!msg.poll) return "";
  const question = escapeHtml(msg.poll.question?.text || "Poll");
  return `<div class="poll-placeholder">📊 <strong>${question}</strong> <span class="poll-note">(poll results not available in transcript)</span></div>`;
}

function renderReply(msg, messageMap) {
  if (!msg.reference) return "";
  const ref = messageMap.get(msg.reference.messageId);

  if (!ref) {
    return `<div class="reply-preview"><span class="reply-icon">↩</span><span class="reply-text reply-missing">Original message not loaded</span></div>`;
  }

  const refName = escapeHtml(ref.member?.displayName ?? ref.author.username);
  let preview = ref.content ? ref.content.replace(/\n/g, " ").slice(0, 80) : "";
  if (!preview) {
    if (ref.attachments.size) preview = "[attachment]";
    else if (ref.embeds.length) preview = "[embed]";
    else preview = "[no content]";
  }
  preview = escapeHtml(preview);

  return `<div class="reply-preview"><span class="reply-icon">↩</span><span class="reply-username">${refName}</span><span class="reply-text">${preview}</span></div>`;
}

function renderMessageActions(msg, guildId) {
  return `<div class="message-actions"><a class="jump-link" href="${getJumpLink(
    guildId,
    msg.channelId,
    msg.id
  )}" target="_blank">Jump to Message</a><span class="message-id">ID: ${msg.id}</span></div>`;
}

// =====================================================
// MESSAGE ROW
// =====================================================

function renderMessage(msg, messageMap, guild, client) {
  const displayName = escapeHtml(msg.member?.displayName ?? msg.author.username);
  const username = escapeHtml(msg.author.username);
  const avatar = msg.author.displayAvatarURL({ extension: "png", size: 64 });
  const roleColor =
    msg.member?.displayHexColor && msg.member.displayHexColor !== "#000000"
      ? msg.member.displayHexColor
      : "#f2f3f5";
  const botBadge = msg.author.bot ? '<span class="bot-badge">BOT</span>' : "";
  const editedLabel = msg.editedTimestamp ? '<span class="edited-label">(edited)</span>' : "";
  const timestamp = formatTimestamp(msg.createdTimestamp);

  const replyHtml = renderReply(msg, messageMap);
  const content = msg.content ? `<div class="message-text">${parseContent(msg.content, guild, client)}</div>` : "";
  const attachmentsHtml = renderAttachments(msg.attachments);
  const embedsHtml = renderEmbeds(msg.embeds, guild, client);
  const stickersHtml = renderStickers(msg.stickers);
  const pollHtml = renderPoll(msg);
  const actionsHtml = renderMessageActions(msg, guild.id);

  return `<div class="message" data-message-id="${msg.id}" title="${escapeHtml(username)}">
  <img class="avatar" src="${avatar}" alt="${username}" loading="lazy">
  <div class="message-body">
    <div class="message-header">
      <span class="username" style="color:${roleColor}">${displayName}</span>
      ${botBadge}
      <span class="timestamp">${timestamp}</span>
      ${editedLabel}
    </div>
    ${replyHtml}
    ${content}
    ${attachmentsHtml}
    ${embedsHtml}
    ${stickersHtml}
    ${pollHtml}
    ${actionsHtml}
  </div>
</div>`;
}

// =====================================================
// HEADER / STATS
// =====================================================

function generateHeader(channel, stats) {
  const guildIcon = channel.guild.iconURL({ extension: "png", size: 128 }) ?? "";
  return `<div class="server">
  <img src="${guildIcon}" alt="${escapeHtml(channel.guild.name)}">
  <div>
    <h1>#${escapeHtml(channel.name)}</h1>
    <div class="server-name">${escapeHtml(channel.guild.name)}</div>
  </div>
</div>
<div class="stats">
  <div class="stat-card"><div class="stat-value">${stats.totalMessages}</div><div class="stat-label">Messages</div></div>
  <div class="stat-card"><div class="stat-value">${stats.uniqueUsers}</div><div class="stat-label">Users</div></div>
  <div class="stat-card"><div class="stat-value">${stats.images}</div><div class="stat-label">Images</div></div>
  <div class="stat-card"><div class="stat-value">${stats.videos}</div><div class="stat-label">Videos</div></div>
  <div class="stat-card"><div class="stat-value">${stats.audio}</div><div class="stat-label">Audio</div></div>
  <div class="stat-card"><div class="stat-value">${stats.files}</div><div class="stat-label">Files</div></div>
  <div class="stat-card"><div class="stat-value">${stats.embeds}</div><div class="stat-label">Embeds</div></div>
  <div class="stat-card"><div class="stat-value">${stats.replies}</div><div class="stat-label">Replies</div></div>
  <div class="stat-card"><div class="stat-value">${stats.edited}</div><div class="stat-label">Edited</div></div>
  <div class="stat-card"><div class="stat-value">${stats.stickers}</div><div class="stat-label">Stickers</div></div>
</div>
<div class="search-container">
  <input type="text" class="search-box" placeholder="Search messages... (Ctrl+F)">
</div>`;
}

// =====================================================
// CSS
// =====================================================

const CSS = `
/* =====================================================
   GLOBAL
===================================================== */
*{ box-sizing:border-box; }
body{
    margin:0;
    background:#313338;
    color:#dbdee1;
    font-family:"gg sans","Helvetica Neue",Helvetica,Arial,sans-serif;
    font-size:15px;
    line-height:1.4;
}
a{ color:#00a8fc; text-decoration:none; }
a:hover{ text-decoration:underline; }

/* =====================================================
   CONTAINER
===================================================== */
.container{
    max-width:960px;
    margin:0 auto;
    padding:24px;
}

/* =====================================================
   HEADER
===================================================== */
.server{
    display:flex;
    align-items:center;
    gap:16px;
    padding-bottom:16px;
    border-bottom:1px solid #3f4147;
    margin-bottom:16px;
}
.server img{
    width:64px;
    height:64px;
    border-radius:50%;
    object-fit:cover;
    background:#1e1f22;
}
.server h1{
    margin:0;
    font-size:22px;
    color:#f2f3f5;
}
.server-name{
    color:#949ba4;
    font-size:14px;
    margin-top:2px;
}

/* =====================================================
   STATS
===================================================== */
.stats{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:10px;
    margin-bottom:20px;
}
.stat-card{
    background:#2b2d31;
    border-radius:8px;
    padding:12px;
    text-align:center;
}
.stat-value{
    font-size:20px;
    font-weight:700;
    color:#f2f3f5;
}
.stat-label{
    margin-top:6px;
    color:#949ba4;
    font-size:14px;
}

/* =====================================================
   SEARCH
===================================================== */
.search-container{
    margin-bottom:20px;
}
.search-box{
    width:100%;
    padding:10px 14px;
    border-radius:8px;
    border:1px solid #3f4147;
    background:#1e1f22;
    color:#dbdee1;
    font-size:14px;
    outline:none;
}
.search-box:focus{
    border-color:#5865F2;
}

/* =====================================================
   MESSAGES
===================================================== */
.messages{
    display:flex;
    flex-direction:column;
    gap:2px;
}
.message{
    display:flex;
    gap:16px;
    padding:8px 10px;
    border-radius:6px;
}
.message:hover{
    background:#2e3035;
}
.message-body{
    flex:1;
    min-width:0;
}
.message-header{
    display:flex;
    align-items:baseline;
    gap:8px;
    flex-wrap:wrap;
}

/* =====================================================
   AVATARS
===================================================== */
.avatar{
    width:40px;
    height:40px;
    border-radius:50%;
    flex:0 0 auto;
    background:#1e1f22;
    object-fit:cover;
}
.username{
    font-weight:600;
    color:#f2f3f5;
}
.bot-badge{
    background:#5865F2;
    color:#fff;
    font-size:10px;
    font-weight:700;
    padding:1px 5px;
    border-radius:3px;
}
.timestamp{
    font-size:12px;
    color:#949ba4;
}
.edited-label{
    font-size:11px;
    color:#949ba4;
    font-style:italic;
}

/* =====================================================
   REPLY
===================================================== */
.reply-preview{
    display:flex;
    align-items:center;
    gap:6px;
    color:#949ba4;
    font-size:13px;
    margin-bottom:2px;
    padding-left:4px;
    border-left:2px solid #4e5058;
}
.reply-icon{ color:#5865F2; }
.reply-username{
    font-weight:600;
    color:#c7c9cd;
}
.reply-text{
    max-width:400px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}
.reply-missing{ font-style:italic; }

/* =====================================================
   MENTIONS
===================================================== */
.mention{
    background:rgba(88,101,242,.3);
    color:#c9cdfb;
    border-radius:3px;
    padding:0 2px;
    font-weight:500;
}
.mention-role{ background:rgba(88,101,242,.25); }
.mention-channel{ background:rgba(88,101,242,.25); }

/* =====================================================
   MARKDOWN / CODE / SPOILERS
===================================================== */
.message-text{
    white-space:pre-wrap;
    word-break:break-word;
    color:#dbdee1;
    margin:2px 0;
}
blockquote{
    margin:4px 0;
    padding:2px 10px;
    border-left:4px solid #4e5058;
    color:#c7c9cd;
}
.inline-code{
    background:#2b2d31;
    border:1px solid #1e1f22;
    border-radius:4px;
    padding:1px 5px;
    font-family:Consolas,Monaco,monospace;
    font-size:13px;
}
.code-block{
    background:#2b2d31;
    border:1px solid #1e1f22;
    border-radius:6px;
    padding:10px 12px;
    overflow-x:auto;
    margin:4px 0;
}
.code-block code{
    font-family:Consolas,Monaco,monospace;
    font-size:13px;
    color:#dbdee1;
}
.spoiler{
    background:#1e1f22;
    color:transparent;
    border-radius:3px;
    cursor:pointer;
    transition:.15s;
}
.spoiler.revealed{
    background:#3a3c42;
    color:inherit;
}
.emoji{
    width:22px;
    height:22px;
    vertical-align:middle;
    object-fit:contain;
}

/* =====================================================
   SEARCH HIGHLIGHT
===================================================== */
.search-highlight{
    background:#f1c40f;
    color:#000;
    border-radius:3px;
    padding:0 2px;
}

/* =====================================================
   ATTACHMENTS
===================================================== */
.attachment-image{
    max-width:400px;
    max-height:300px;
    border-radius:8px;
    margin-top:6px;
    display:block;
    cursor:zoom-in;
}
.attachment-video{
    max-width:400px;
    border-radius:8px;
    margin-top:6px;
    display:block;
}
.attachment-audio{
    margin-top:6px;
    display:block;
    width:320px;
    max-width:100%;
}
.attachment-file{
    display:block;
    margin-top:6px;
    padding:8px 12px;
    background:#2b2d31;
    border-radius:6px;
    color:#00a8fc;
    width:fit-content;
}

/* =====================================================
   EMBEDS
===================================================== */
.embed{
    margin-top:8px;
    padding:10px 14px;
    background:#2b2d31;
    border-left:4px solid #5865F2;
    border-radius:6px;
    max-width:520px;
}
.embed-author{
    display:flex;
    align-items:center;
    gap:6px;
    font-size:13px;
    font-weight:600;
    color:#f2f3f5;
    margin-bottom:4px;
}
.embed-author-icon{
    width:20px;
    height:20px;
    border-radius:50%;
}
.embed-title{
    font-weight:700;
    color:#00a8fc;
    margin-bottom:4px;
    display:block;
}
.embed-description{
    font-size:14px;
    color:#dbdee1;
    white-space:pre-wrap;
}
.embed-fields{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:8px;
    margin-top:8px;
}
.embed-field{
    grid-column:span 2;
}
.embed-field.inline{
    grid-column:span 1;
}
.embed-field-name{
    font-weight:700;
    font-size:13px;
    color:#f2f3f5;
    margin-bottom:2px;
}
.embed-field-value{
    font-size:13px;
    color:#c7c9cd;
}
.embed-thumbnail{
    max-width:80px;
    max-height:80px;
    border-radius:6px;
    float:right;
    margin-left:10px;
}
.embed-image{
    max-width:100%;
    border-radius:6px;
    margin-top:8px;
    display:block;
}
.embed-footer{
    display:flex;
    align-items:center;
    gap:6px;
    margin-top:8px;
    font-size:12px;
    color:#949ba4;
}
.embed-footer-icon{
    width:18px;
    height:18px;
    border-radius:50%;
}

/* =====================================================
   STICKERS
===================================================== */
.stickers{
    margin-top:6px;
}
.sticker{
    width:120px;
    height:120px;
    object-fit:contain;
}

/* =====================================================
   POLL PLACEHOLDER
===================================================== */
.poll-placeholder{
    margin-top:8px;
    padding:10px 14px;
    background:#2b2d31;
    border-radius:6px;
    font-size:13px;
    color:#c7c9cd;
}
.poll-note{
    color:#949ba4;
    font-size:12px;
}

/* =====================================================
   MESSAGE ACTIONS
===================================================== */
.message-actions{
    display:flex;
    align-items:center;
    gap:10px;
    margin-top:6px;
    font-size:12px;
    color:#6d6f78;
}
.jump-link{
    color:#00a8fc;
}
.message-id{
    color:#6d6f78;
}

/* =====================================================
   BACK TO TOP BUTTON
===================================================== */
.back-to-top{
    position:fixed;
    right:30px;
    bottom:30px;
    width:48px;
    height:48px;
    border:none;
    border-radius:50%;
    background:#5865F2;
    color:#fff;
    font-size:20px;
    cursor:pointer;
    display:none;
    align-items:center;
    justify-content:center;
    box-shadow:0 6px 18px rgba(0,0,0,.35);
    transition:.2s;
    z-index:999;
}
.back-to-top:hover{
    transform:translateY(-2px);
    background:#4752c4;
}

/* =====================================================
   IMAGE MODAL
===================================================== */
.image-modal{
    position:fixed;
    inset:0;
    display:none;
    justify-content:center;
    align-items:center;
    background:rgba(0,0,0,.88);
    z-index:9999;
}
.image-modal img{
    max-width:92%;
    max-height:92%;
    border-radius:10px;
    box-shadow:0 0 30px rgba(0,0,0,.6);
    cursor:zoom-out;
}

/* =====================================================
   SCROLLBAR
===================================================== */
::-webkit-scrollbar{ width:10px; }
::-webkit-scrollbar-track{ background:#1e1f22; }
::-webkit-scrollbar-thumb{ background:#4e5058; border-radius:20px; }
::-webkit-scrollbar-thumb:hover{ background:#6d6f78; }

/* =====================================================
   RESPONSIVE
===================================================== */
@media (max-width:900px){
    .container{ width:100%; padding:15px; }
    .server{ flex-direction:column; align-items:flex-start; }
    .server img{ width:60px; height:60px; }
    .stats{ grid-template-columns:repeat(3,1fr); }
    .attachment-image,.attachment-video{ max-width:100%; }
    .reply-text{ max-width:220px; }
    .embed{ max-width:100%; }
}
@media (max-width:600px){
    .message{ gap:10px; padding:8px 6px; }
    .avatar{ width:34px; height:34px; }
    .username{ font-size:14px; }
    .stats{ grid-template-columns:repeat(2,1fr); }
    .embed-fields{ grid-template-columns:1fr; }
    .embed-field{ grid-column:span 1 !important; }
}

/* =====================================================
   PRINT
===================================================== */
@media print{
    body{ background:white; color:black; }
    .back-to-top{ display:none !important; }
    .search-container{ display:none; }
    .message:hover{ background:none; }
}
`;

function generateHead(title) {
  return `<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>`;
}

// =====================================================
// SCRIPTS
// =====================================================

function generateScripts() {
  return `<script>
(function () {
  "use strict";

  // ---------- LIVE SEARCH ----------
  var searchBox = document.querySelector(".search-box");
  var lastHighlighted = [];

  function clearHighlights() {
    for (var i = 0; i < lastHighlighted.length; i++) {
      var el = lastHighlighted[i];
      el.innerHTML = el.dataset.originalHtml;
    }
    lastHighlighted = [];
  }

  function highlightMatch(el, query) {
    if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
    var regex = new RegExp("(" + query.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + ")", "ig");
    el.innerHTML = el.dataset.originalHtml.replace(regex, "<mark class=\\"search-highlight\\">$1</mark>");
    lastHighlighted.push(el);
  }

  if (searchBox) {
    searchBox.addEventListener("input", function () {
      var query = this.value.trim().toLowerCase();
      var messages = document.querySelectorAll(".message");
      clearHighlights();

      var firstMatch = null;

      messages.forEach(function (message) {
        var content = message.innerText.toLowerCase();

        if (!query) {
          message.style.display = "flex";
          return;
        }

        if (content.indexOf(query) !== -1) {
          message.style.display = "flex";
          if (!firstMatch) firstMatch = message;
          var textEl = message.querySelector(".message-text");
          if (textEl) highlightMatch(textEl, query);
        } else {
          message.style.display = "none";
        }
      });

      if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  // ---------- CTRL+F FOCUSES SEARCH ----------
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      if (searchBox) {
        e.preventDefault();
        searchBox.focus();
      }
    }
    if (e.key === "Escape") {
      var modal = document.querySelector(".image-modal");
      if (modal && modal.style.display === "flex") {
        modal.style.display = "none";
      }
    }
  });

  // ---------- BACK TO TOP ----------
  var topButton = document.querySelector(".back-to-top");
  if (topButton) {
    window.addEventListener("scroll", function () {
      topButton.style.display = window.scrollY > 500 ? "flex" : "none";
    });
    topButton.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ---------- SPOILERS ----------
  document.querySelectorAll(".spoiler").forEach(function (spoiler) {
    spoiler.addEventListener("click", function () {
      spoiler.classList.add("revealed");
    });
  });

  // ---------- IMAGE ZOOM ----------
  var modal = document.querySelector(".image-modal");
  if (modal) {
    var modalImage = modal.querySelector("img");
    document.querySelectorAll(".attachment-image, .embed-thumbnail, .embed-image").forEach(function (image) {
      image.style.cursor = "zoom-in";
      image.addEventListener("click", function () {
        modal.style.display = "flex";
        modalImage.src = image.src;
      });
    });
    modal.addEventListener("click", function () {
      modal.style.display = "none";
    });
  }
})();
</script>`;
}

// =====================================================
// FULL PAGE ASSEMBLY
// =====================================================

function generateTranscript(channel, messagesHtml, stats) {
  const title = `#${channel.name} transcript`;
  return `<!DOCTYPE html>
<html lang="en">
${generateHead(title)}
<body>
<div class="container">
${generateHeader(channel, stats)}
<div class="messages">
${messagesHtml}
</div>
</div>
<button class="back-to-top">↑</button>
<div class="image-modal"><img src="" alt=""></div>
${generateScripts()}
</body>
</html>`;
}

// =====================================================
// MESSAGE FETCHING (paginated, since Discord caps a single fetch at 100)
// =====================================================

async function fetchMessages(channel, limit) {
  const collected = [];
  let beforeId;

  while (collected.length < limit) {
    const batchSize = Math.min(100, limit - collected.length);
    const options = { limit: batchSize };
    if (beforeId) options.before = beforeId;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    collected.push(...batch.values());
    beforeId = batch.last().id;

    if (batch.size < batchSize) break;
  }

  // Newest-first from the API; reverse to chronological order.
  return collected.reverse();
}

function buildStats(messages) {
  const stats = {
    totalMessages: messages.length,
    uniqueUsers: 0,
    images: 0,
    videos: 0,
    audio: 0,
    files: 0,
    embeds: 0,
    replies: 0,
    edited: 0,
    stickers: 0,
  };

  const userIds = new Set();

  for (const msg of messages) {
    userIds.add(msg.author.id);
    if (msg.editedTimestamp) stats.edited++;
    if (msg.reference) stats.replies++;
    stats.embeds += msg.embeds.length;
    stats.stickers += msg.stickers.size;

    for (const att of msg.attachments.values()) {
      const type = att.contentType || "";
      if (type.startsWith("image/")) stats.images++;
      else if (type.startsWith("video/")) stats.videos++;
      else if (type.startsWith("audio/")) stats.audio++;
      else stats.files++;
    }
  }

  stats.uniqueUsers = userIds.size;
  return stats;
}

// =====================================================
// SLASH COMMAND
// =====================================================

const commandData = new SlashCommandBuilder()
  .setName("transcript")
  .setDescription("Generate an HTML transcript of a channel")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Channel to create transcript from (defaults to this channel)")
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread
      )
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("limit")
      .setDescription(`Number of messages (1-${MAX_MESSAGES})`)
      .setMinValue(1)
      .setMaxValue(MAX_MESSAGES)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function runTranscript(interaction) {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed("Run this inside a server text channel.")],
      ephemeral: true,
    });
    return;
  }

  // --- permission check: Administrators OR any whitelisted role ---
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  const hasAllowedRole = ALLOWED_ROLE_IDS.some((id) => interaction.member.roles.cache.has(id));

  if (!isAdmin && !hasAllowedRole) {
    await interaction.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
      ephemeral: true,
    });
    return;
  }

  // --- resolve target channel (defaults to the channel the command was run in) ---
  const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;

  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.reply({
      embeds: [errorEmbed("That channel isn't a text channel I can read.")],
      ephemeral: true,
    });
    return;
  }

  const botPerms = targetChannel.permissionsFor(interaction.client.user);
  if (
    !botPerms ||
    !botPerms.has(PermissionFlagsBits.ViewChannel) ||
    !botPerms.has(PermissionFlagsBits.ReadMessageHistory)
  ) {
    await interaction.reply({
      embeds: [errorEmbed(`I don't have permission to read message history in ${targetChannel}.`)],
      ephemeral: true,
    });
    return;
  }

  let limit = interaction.options.getInteger("limit") ?? DEFAULT_LIMIT;
  if (limit > MAX_MESSAGES) limit = MAX_MESSAGES;
  if (limit < 1) limit = 1;

  await interaction.deferReply();

  let messages;
  try {
    messages = await fetchMessages(targetChannel, limit);
  } catch (err) {
    console.error("transcript fetch error:", err);
    await interaction.editReply({
      embeds: [errorEmbed("Failed to fetch messages from that channel.")],
    });
    return;
  }

  const messageMap = new Map(messages.map((m) => [m.id, m]));
  const stats = buildStats(messages);
  const guild = interaction.guild;
  const client = interaction.client;

  const messagesHtml = messages.map((msg) => renderMessage(msg, messageMap, guild, client)).join("\n");
  const page = generateTranscript(targetChannel, messagesHtml, stats);

  const buffer = Buffer.from(page, "utf-8");
  const attachment = new AttachmentBuilder(buffer, {
    name: `${targetChannel.name}-transcript.html`,
  });

  await interaction.editReply({
    embeds: [successEmbed(`Pulled ${messages.length} message(s) from ${targetChannel}.`)],
    files: [attachment],
  });
}

// =====================================================
// EXPORT
// =====================================================
// This file is loaded as: require('./events/transcript')(client);
// so it must export ONE function that takes `client` and wires itself up.

module.exports = (client) => {
  client.once("ready", async () => {
    try {
      await client.application.commands.create(commandData);
    } catch (err) {
      console.error("Failed to register /transcript command:", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "transcript") return;

    try {
      await runTranscript(interaction);
    } catch (err) {
      console.error("transcript command error:", err);
    }
  });
};
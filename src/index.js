require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  ActivityType,
} = require('discord.js');

const db                        = require('./database');
const { commands, handleCommand } = require('./commands');

// ── Validasi Token ────────────────────────────────────────────────────────────
const TOKEN    = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN tidak ditemukan di environment variables!');
  console.error('   Pastikan sudah diset di Railway → Variables → DISCORD_TOKEN');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID tidak ditemukan di environment variables!');
  console.error('   Pastikan sudah diset di Railway → Variables → CLIENT_ID');
  process.exit(1);
}

// ── Regex & Helper ────────────────────────────────────────────────────────────
const URL_REGEX = /(?:https?:\/\/|www\.|ftp:\/\/)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi;

const IMAGE_EXTS = new Set(['.png','.jpg','.jpeg','.gif','.webp','.bmp','.tiff','.tif','.svg','.ico']);

function hasLink(text) {
  if (!text) return false;
  return URL_REGEX.test(text);
}

function extractDomains(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  const domains = new Set();
  for (const url of matches) {
    try {
      const full = url.startsWith('http') ? url : `http://${url}`;
      const host = new URL(full).hostname;
      if (host) domains.add(host.toLowerCase());
    } catch {}
  }
  return [...domains];
}

function hasImage(message) {
  // Cek attachment
  for (const att of message.attachments.values()) {
    const ext = att.name ? '.' + att.name.split('.').pop().toLowerCase() : '';
    if (IMAGE_EXTS.has(ext)) return true;
    if (att.contentType?.startsWith('image/')) return true;
  }
  // Cek embed
  for (const embed of message.embeds) {
    if (embed.image || embed.thumbnail) return true;
  }
  return false;
}

// ── Register Slash Commands ───────────────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('⏳ Mendaftarkan slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands berhasil didaftarkan!');
  } catch (e) {
    console.error('❌ Gagal mendaftarkan slash commands:', e.message);
  }
}

// ── Bot Client ────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ── Event: Ready ──────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async () => {
  console.log(`✅ Login sebagai ${client.user.tag}`);
  console.log(`📡 Melayani ${client.guilds.cache.size} server`);
  client.user.setActivity('🛡️ /automod help', { type: ActivityType.Watching });
  await registerCommands();
});

// ── Event: Guild Remove ───────────────────────────────────────────────────────
client.on(Events.GuildDelete, guild => {
  db.deleteGuild(guild.id);
  console.log(`🚪 Keluar dari: ${guild.name} — config dihapus`);
});

// ── Event: Interaction ────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, interaction => {
  handleCommand(interaction, db);
});

// ── Event: Message Create & Edit ──────────────────────────────────────────────
client.on(Events.MessageCreate, msg => checkMessage(msg));
client.on(Events.MessageUpdate, (_old, msg) => {
  if (msg.partial) return;
  checkMessage(msg);
});

async function checkMessage(message) {
  // Abaikan DM, bot, dan partial
  if (!message.guild) return;
  if (message.author?.bot) return;
  if (message.partial) return;

  const guildId   = message.guild.id;
  const channelId = message.channel.id;
  const member    = message.member;
  if (!member) return;

  // ── Cek Exempt ──────────────────────────────────────────────────────────
  if (member.permissions.has('Administrator')) return;

  const allowedRoles = new Set(db.getRoles(guildId));
  const memberRoles  = new Set(member.roles.cache.keys());
  for (const rid of allowedRoles) {
    if (memberRoles.has(rid)) return; // exempt
  }

  // ── Ambil Config ────────────────────────────────────────────────────────
  const gcfg = db.getGuild(guildId);
  const ccfg = db.getChannel(channelId);

  const deleteLinks  = !!(ccfg?.delete_links  || gcfg?.delete_links);
  const deleteImages = !!(ccfg?.delete_images || gcfg?.delete_images);

  if (!deleteLinks && !deleteImages) return;

  const whitelist = new Set(
    ccfg?.whitelist ? ccfg.whitelist.split(',').filter(Boolean) : []
  );

  let reason = null;

  // ── Cek Link ─────────────────────────────────────────────────────────────
  if (deleteLinks && hasLink(message.content)) {
    const domains = extractDomains(message.content);
    const blocked = domains.filter(d => !whitelist.has(d));
    if (blocked.length) {
      const list   = blocked.slice(0, 3).join('`, `');
      const suffix = blocked.length > 3 ? '...' : '';
      reason = `Link terdeteksi (\`${list}\`${suffix})`;
    }
  }

  // ── Cek Gambar ───────────────────────────────────────────────────────────
  if (!reason && deleteImages && hasImage(message)) {
    reason = 'Gambar/media tidak diizinkan di channel ini';
  }

  if (!reason) return;

  // ── Hapus Pesan ───────────────────────────────────────────────────────────
  try {
    await message.delete();
    console.log(`[${message.guild.name}] Dihapus dari ${message.author.tag} di #${message.channel.name}: ${reason}`);
  } catch (e) {
    if (e.code === 10008) return; // Unknown Message — sudah dihapus
    console.error(`Gagal hapus pesan: ${e.message}`);
    return;
  }

  // ── Catat Log ─────────────────────────────────────────────────────────────
  const content = message.content?.slice(0, 500) || '';
  db.logDelete(guildId, channelId, message.author.id, reason, content);

  // ── Kirim ke Log Channel ──────────────────────────────────────────────────
  if (gcfg?.log_channel) {
    const logCh = message.guild.channels.cache.get(gcfg.log_channel);
    if (logCh) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setColor(0xE74C3C)
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: 'Channel', value: `<#${channelId}>`, inline: true },
          { name: 'Reason',  value: reason,             inline: true },
          { name: 'User ID', value: message.author.id,  inline: true },
        )
        .setTimestamp()
        .setFooter({ text: message.guild.name });

      if (content) {
        embed.addFields({ name: 'Content', value: `\`\`\`${content.slice(0, 900)}\`\`\``, inline: false });
      }
      logCh.send({ embeds: [embed] }).catch(() => {});
    }
  }

  // ── DM User ───────────────────────────────────────────────────────────────
  if (gcfg?.warn_user) {
    const { EmbedBuilder } = require('discord.js');
    const dmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Pesan Dihapus')
      .setDescription(
        `Pesanmu di **#${message.channel.name}** (${message.guild.name}) dihapus.\n` +
        `**Alasan:** ${reason}\n\nMohon patuhi peraturan server.`
      )
      .setColor(0xF39C12);
    message.author.send({ embeds: [dmEmbed] }).catch(() => {});
  }
}

// ── Error Handling Global ─────────────────────────────────────────────────────
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
process.on('uncaughtException',  err => { console.error('Uncaught Exception:', err); process.exit(1); });

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(TOKEN);

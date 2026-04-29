const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// ── Embed Helpers ─────────────────────────────────────────────────────────────
const ok   = (title, desc = '') => new EmbedBuilder().setTitle(`✅ ${title}`).setDescription(desc).setColor(0x2ECC71);
const info = (title, desc = '') => new EmbedBuilder().setTitle(`ℹ️ ${title}`).setDescription(desc).setColor(0x3498DB);
const err  = (title, desc = '') => new EmbedBuilder().setTitle(`❌ ${title}`).setDescription(desc).setColor(0xE74C3C);

// ── Command Definitions ───────────────────────────────────────────────────────
const commands = [
  // /automod status
  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('🛡️ Kelola pengaturan AutoMod')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('status').setDescription('Tampilkan konfigurasi AutoMod saat ini'))
    .addSubcommand(s => s.setName('help').setDescription('Tampilkan semua perintah AutoMod'))
    .addSubcommand(s => s
      .setName('log')
      .setDescription('Riwayat penghapusan otomatis')
      .addIntegerOption(o => o.setName('limit').setDescription('Jumlah entri (1–20)').setMinValue(1).setMaxValue(20))
    )
    // server subcommands
    .addSubcommandGroup(g => g
      .setName('server')
      .setDescription('Konfigurasi server-wide')
      .addSubcommand(s => s
        .setName('links')
        .setDescription('Toggle filter link server-wide')
        .addBooleanOption(o => o.setName('enabled').setDescription('Aktifkan atau matikan').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('images')
        .setDescription('Toggle filter gambar server-wide')
        .addBooleanOption(o => o.setName('enabled').setDescription('Aktifkan atau matikan').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('logchannel')
        .setDescription('Set channel untuk mod-log')
        .addChannelOption(o => o.setName('channel').setDescription('Channel tujuan log').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('warn')
        .setDescription('Toggle DM peringatan ke user saat pesan dihapus')
        .addBooleanOption(o => o.setName('enabled').setDescription('Aktifkan atau matikan').setRequired(true))
      )
    )
    // channel subcommands
    .addSubcommandGroup(g => g
      .setName('channel')
      .setDescription('Konfigurasi per channel')
      .addSubcommand(s => s
        .setName('links')
        .setDescription('Toggle filter link di channel tertentu')
        .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
        .addBooleanOption(o => o.setName('enabled').setDescription('Aktifkan atau matikan').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('images')
        .setDescription('Toggle filter gambar di channel tertentu')
        .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
        .addBooleanOption(o => o.setName('enabled').setDescription('Aktifkan atau matikan').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('whitelist_add')
        .setDescription('Izinkan domain tertentu di channel')
        .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
        .addStringOption(o => o.setName('domain').setDescription('Contoh: youtube.com').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('whitelist_remove')
        .setDescription('Hapus domain dari whitelist channel')
        .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
        .addStringOption(o => o.setName('domain').setDescription('Domain yang ingin dihapus').setRequired(true))
      )
    )
    // role subcommands
    .addSubcommandGroup(g => g
      .setName('role')
      .setDescription('Kelola role yang bypass semua filter')
      .addSubcommand(s => s
        .setName('add')
        .setDescription('Tambah role ke daftar exempt')
        .addRoleOption(o => o.setName('role').setDescription('Role yang akan dibebaskan').setRequired(true))
      )
      .addSubcommand(s => s
        .setName('remove')
        .setDescription('Hapus role dari daftar exempt')
        .addRoleOption(o => o.setName('role').setDescription('Role yang ingin dihapus').setRequired(true))
      )
      .addSubcommand(s => s.setName('list').setDescription('Lihat semua role yang exempt'))
    )
].map(c => c.toJSON());

// ── Command Handlers ──────────────────────────────────────────────────────────
async function handleCommand(interaction, db) {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'automod') return;

  const sub   = interaction.options.getSubcommand(false);
  const group = interaction.options.getSubcommandGroup(false);
  const guild = interaction.guild;

  try {
    // ── Top-level subcommands ──────────────────────────────────────────────
    if (!group) {
      if (sub === 'status') return await handleStatus(interaction, db);
      if (sub === 'help')   return await handleHelp(interaction);
      if (sub === 'log')    return await handleLog(interaction, db);
    }

    // ── server group ───────────────────────────────────────────────────────
    if (group === 'server') {
      const enabled = interaction.options.getBoolean('enabled');
      const onOff   = enabled ? '🟢 aktif' : '🔴 nonaktif';

      if (sub === 'links') {
        db.upsertGuild(guild.id, { delete_links: enabled ? 1 : 0 });
        return interaction.reply({ embeds: [ok('Server Link Filter', `Filter link **${onOff}** server-wide`)], ephemeral: true });
      }
      if (sub === 'images') {
        db.upsertGuild(guild.id, { delete_images: enabled ? 1 : 0 });
        return interaction.reply({ embeds: [ok('Server Image Filter', `Filter gambar **${onOff}** server-wide`)], ephemeral: true });
      }
      if (sub === 'logchannel') {
        const ch = interaction.options.getChannel('channel');
        db.upsertGuild(guild.id, { log_channel: ch.id });
        return interaction.reply({ embeds: [ok('Log Channel Set', `Mod log dikirim ke ${ch}`)], ephemeral: true });
      }
      if (sub === 'warn') {
        db.upsertGuild(guild.id, { warn_user: enabled ? 1 : 0 });
        return interaction.reply({ embeds: [ok('User Warning', `DM peringatan **${onOff}**`)], ephemeral: true });
      }
    }

    // ── channel group ──────────────────────────────────────────────────────
    if (group === 'channel') {
      const ch      = interaction.options.getChannel('channel');
      const enabled = interaction.options.getBoolean('enabled');
      const onOff   = enabled ? '🟢 aktif' : '🔴 nonaktif';

      if (sub === 'links') {
        db.upsertChannel(ch.id, guild.id, { delete_links: enabled ? 1 : 0 });
        return interaction.reply({ embeds: [ok('Channel Link Filter', `Filter link **${onOff}** di ${ch}`)], ephemeral: true });
      }
      if (sub === 'images') {
        db.upsertChannel(ch.id, guild.id, { delete_images: enabled ? 1 : 0 });
        return interaction.reply({ embeds: [ok('Channel Image Filter', `Filter gambar **${onOff}** di ${ch}`)], ephemeral: true });
      }
      if (sub === 'whitelist_add') {
        let domain = interaction.options.getString('domain').toLowerCase().trim();
        domain = domain.replace(/^https?:\/\//, '').split('/')[0];
        db.addWhitelist(ch.id, guild.id, domain);
        return interaction.reply({ embeds: [ok('Whitelist Updated', `\`${domain}\` ditambahkan ke whitelist ${ch}`)], ephemeral: true });
      }
      if (sub === 'whitelist_remove') {
        const domain = interaction.options.getString('domain').toLowerCase().trim();
        db.removeWhitelist(ch.id, guild.id, domain);
        return interaction.reply({ embeds: [ok('Whitelist Updated', `\`${domain}\` dihapus dari whitelist ${ch}`)], ephemeral: true });
      }
    }

    // ── role group ─────────────────────────────────────────────────────────
    if (group === 'role') {
      if (sub === 'add') {
        const role = interaction.options.getRole('role');
        db.addRole(guild.id, role.id);
        return interaction.reply({ embeds: [ok('Exempt Role Added', `${role} kini bebas dari semua filter`)], ephemeral: true });
      }
      if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        db.removeRole(guild.id, role.id);
        return interaction.reply({ embeds: [ok('Exempt Role Removed', `${role} dihapus dari daftar exempt`)], ephemeral: true });
      }
      if (sub === 'list') {
        const roleIds  = db.getRoles(guild.id);
        const mentions = roleIds.map(id => guild.roles.cache.get(id)).filter(Boolean).map(r => r.toString());
        return interaction.reply({
          embeds: [info('Exempt Roles', mentions.length ? mentions.join(', ') : 'Tidak ada role exempt.')],
          ephemeral: true,
        });
      }
    }

  } catch (e) {
    console.error('[Command Error]', e);
    const payload = { embeds: [err('Error', `Terjadi kesalahan: \`${e.message}\``)], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
}

// ── /automod status ───────────────────────────────────────────────────────────
async function handleStatus(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  const guild    = interaction.guild;
  const gcfg     = db.getGuild(guild.id);
  const channels = db.getAllChannels(guild.id);
  const roleIds  = db.getRoles(guild.id);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ AutoMod Status')
    .setColor(0x5865F2)
    .setThumbnail(guild.iconURL());

  const gLinks  = gcfg?.delete_links  ? '🟢 On' : '🔴 Off';
  const gImages = gcfg?.delete_images ? '🟢 On' : '🔴 Off';
  const gWarn   = gcfg?.warn_user     ? '🟢 On' : '🔴 Off';
  const logCh   = gcfg?.log_channel   ? `<#${gcfg.log_channel}>` : 'Belum diset';

  embed.addFields({
    name: '🌐 Server-wide',
    value: `**Filter Link:** ${gLinks}\n**Filter Gambar:** ${gImages}\n**Warn Users:** ${gWarn}\n**Log Channel:** ${logCh}`,
    inline: false,
  });

  const roleMentions = roleIds.map(id => guild.roles.cache.get(id)).filter(Boolean).map(r => r.toString());
  embed.addFields({
    name: '🔓 Exempt Roles',
    value: roleMentions.length ? roleMentions.join(', ') : 'Tidak ada',
    inline: false,
  });

  if (channels.length > 0) {
    const lines = channels.slice(0, 10).map(ch => {
      const flags = [];
      if (ch.delete_links)  flags.push('🔗 links');
      if (ch.delete_images) flags.push('🖼️ images');
      const wl = ch.whitelist ? ch.whitelist.split(',').filter(Boolean) : [];
      if (wl.length) flags.push(`✅ \`${wl.slice(0, 3).join(', ')}\``);
      return flags.length ? `<#${ch.channel_id}>: ${flags.join(' | ')}` : null;
    }).filter(Boolean);

    if (lines.length) {
      embed.addFields({ name: '📋 Channel Overrides', value: lines.join('\n'), inline: false });
    }
  }

  embed.setFooter({ text: `Guild ID: ${guild.id}` });
  await interaction.editReply({ embeds: [embed] });
}

// ── /automod log ──────────────────────────────────────────────────────────────
async function handleLog(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  const limit = interaction.options.getInteger('limit') || 5;
  const rows  = db.getLog(interaction.guild.id, limit);

  if (!rows.length) {
    return interaction.editReply({ embeds: [info('Delete Log', 'Belum ada entri.')] });
  }

  const embed = new EmbedBuilder().setTitle('📋 Recent Deletions').setColor(0xF39C12);
  for (const row of rows) {
    const member  = interaction.guild.members.cache.get(row.user_id);
    const channel = interaction.guild.channels.cache.get(row.channel_id);
    embed.addFields({
      name: `🕐 ${row.deleted_at} UTC`,
      value: `**User:** ${member ? member.user.tag : `ID:${row.user_id}`}\n**Channel:** ${channel ? `#${channel.name}` : row.channel_id}\n**Reason:** ${row.reason}`,
      inline: false,
    });
  }
  await interaction.editReply({ embeds: [embed] });
}

// ── /automod help ─────────────────────────────────────────────────────────────
async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ AutoMod Bot — Help')
    .setDescription('Auto-delete link dan gambar dengan kontrol penuh.')
    .setColor(0x5865F2)
    .addFields(
      { name: '📊 Umum', value: '`/automod status` — Lihat config\n`/automod log` — Riwayat hapus', inline: false },
      { name: '🌐 Server `/automod server`', value: '`links on/off` — Filter link\n`images on/off` — Filter gambar\n`logchannel #ch` — Set log channel\n`warn on/off` — DM ke user', inline: false },
      { name: '📌 Channel `/automod channel`', value: '`links #ch on/off` — Filter link\n`images #ch on/off` — Filter gambar\n`whitelist_add #ch domain` — Izinkan domain\n`whitelist_remove #ch domain` — Hapus domain', inline: false },
      { name: '🔓 Role `/automod role`', value: '`add @role` — Tambah exempt\n`remove @role` — Hapus exempt\n`list` — Lihat semua', inline: false },
      { name: '💡 Tips', value: '• Admin selalu exempt\n• Config channel override server-wide\n• Bot butuh permission **Manage Messages**', inline: false },
    )
    .setFooter({ text: 'Semua command butuh permission Administrator' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { commands, handleCommand };

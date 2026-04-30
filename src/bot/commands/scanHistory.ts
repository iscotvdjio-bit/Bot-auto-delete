import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Message,
  type TextBasedChannel,
} from "discord.js";
import { db } from "../../db/index.js";
import { deletionLogsTable } from "../../db/index.js";
import { logger } from "../../lib/logger.js";
import { getChannelOverride, getGuildSettings, getWhitelist } from "../settings.js";
import { scanMessage } from "../messageScanner.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const FETCHABLE_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

export async function handleScanHistory(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;

  const guildId = interaction.guildId;
  const amount = interaction.options.getInteger("amount", true);
  const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;

  if (!targetChannel || !("id" in targetChannel)) {
    await interaction.reply({ content: "Channel tidak valid.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!FETCHABLE_TYPES.has(targetChannel.type)) {
    await interaction.reply({ content: "Tipe channel tidak didukung untuk scan history.", flags: MessageFlags.Ephemeral });
    return;
  }

  const me = interaction.guild.members.me;
  const perms = me ? interaction.guild.channels.cache.get(targetChannel.id)?.permissionsFor(me) : null;
  if (
    !perms ||
    !perms.has(PermissionFlagsBits.ViewChannel) ||
    !perms.has(PermissionFlagsBits.ReadMessageHistory) ||
    !perms.has(PermissionFlagsBits.ManageMessages)
  ) {
    await interaction.reply({
      content: `Bot perlu izin **View Channel**, **Read Message History**, dan **Manage Messages** di <#${targetChannel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const settings = await getGuildSettings(guildId);
  const override = await getChannelOverride(guildId, targetChannel.id);

  let rules = {
    deleteLinks: settings.deleteLinks,
    deleteImages: settings.deleteImages,
    deleteAttachments: settings.deleteAttachments,
  };
  if (override?.mode === "strict") {
    rules = { deleteLinks: true, deleteImages: true, deleteAttachments: true };
  }
  if (override) {
    if (override.deleteLinks !== null && override.deleteLinks !== undefined)
      rules.deleteLinks = override.deleteLinks;
    if (override.deleteImages !== null && override.deleteImages !== undefined)
      rules.deleteImages = override.deleteImages;
    if (override.deleteAttachments !== null && override.deleteAttachments !== undefined)
      rules.deleteAttachments = override.deleteAttachments;
  }

  if (!rules.deleteLinks && !rules.deleteImages && !rules.deleteAttachments) {
    await interaction.editReply({
      content: "Semua aturan penghapusan nonaktif untuk channel ini. Aktifkan dengan `/config` atau `/channel strict` dulu.",
    });
    return;
  }

  const whitelist = await getWhitelist(guildId);
  const whitelistedUsers = new Set(whitelist.filter((w) => w.targetType === "user").map((w) => w.targetId));
  const whitelistedRoles = new Set(whitelist.filter((w) => w.targetType === "role").map((w) => w.targetId));

  const channel = targetChannel as TextBasedChannel & {
    messages: { fetch: (opts: object) => Promise<Map<string, Message>> };
    bulkDelete?: (messages: Message[] | string[], filterOld?: boolean) => Promise<Map<string, Message>>;
  };

  const matched: Message[] = [];
  let scanned = 0;
  let lastId: string | undefined = undefined;
  const cap = Math.min(amount, 1000);

  while (scanned < cap) {
    const batchSize = Math.min(100, cap - scanned);
    const fetched: Map<string, Message> = await channel.messages.fetch({
      limit: batchSize,
      ...(lastId ? { before: lastId } : {}),
    });
    if (fetched.size === 0) break;

    for (const msg of fetched.values()) {
      scanned += 1;
      if (msg.author.bot) continue;
      if (msg.system) continue;
      if (whitelistedUsers.has(msg.author.id)) continue;
      if (msg.member && msg.member.permissions.has(PermissionFlagsBits.ManageMessages)) continue;
      if (msg.member && Array.from(whitelistedRoles).some((r) => msg.member!.roles.cache.has(r))) continue;

      const reasons = scanMessage(msg, rules);
      if (reasons.length > 0) matched.push(msg);

      lastId = msg.id;
    }

    if (fetched.size < batchSize) break;
  }

  if (matched.length === 0) {
    await interaction.editReply({
      content: `Selesai. Memindai ${scanned} pesan, **tidak ada** yang melanggar aturan.`,
    });
    return;
  }

  const now = Date.now();
  const recent = matched.filter((m) => now - m.createdTimestamp < FOURTEEN_DAYS_MS);
  const old = matched.filter((m) => now - m.createdTimestamp >= FOURTEEN_DAYS_MS);

  let deleted = 0;
  let failed = 0;

  if (recent.length > 0 && channel.bulkDelete) {
    for (let i = 0; i < recent.length; i += 100) {
      const slice = recent.slice(i, i + 100);
      try {
        if (slice.length === 1) {
          await slice[0]!.delete();
          deleted += 1;
        } else {
          const result = await channel.bulkDelete(slice, true);
          deleted += result.size;
        }
      } catch (err) {
        logger.error({ err }, "bulkDelete failed");
        failed += slice.length;
      }
    }
  }

  for (const m of old) {
    try {
      await m.delete();
      deleted += 1;
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      logger.error({ err, id: m.id }, "Old message delete failed");
      failed += 1;
    }
  }

  try {
    await db.insert(deletionLogsTable).values(
      matched.slice(0, deleted).map((m) => ({
        guildId,
        channelId: targetChannel.id,
        userId: m.author.id,
        reason: "scan-history",
        contentSnippet: (m.content ?? "").slice(0, 200) || null,
      })),
    );
  } catch (err) {
    logger.error({ err }, "Failed to log scan-history deletions");
  }

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("Scan history selesai")
    .addFields(
      { name: "Channel", value: `<#${targetChannel.id}>`, inline: true },
      { name: "Dipindai", value: String(scanned), inline: true },
      { name: "Cocok", value: String(matched.length), inline: true },
      { name: "Dihapus", value: String(deleted), inline: true },
      { name: "Gagal", value: String(failed), inline: true },
    );

  await interaction.editReply({ embeds: [embed] });
}

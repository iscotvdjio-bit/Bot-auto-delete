import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Message,
  type TextChannel,
} from "discord.js";
import { db } from "../db/index.js";
import { deletionLogsTable } from "../db/index.js";
import { logger } from "../lib/logger.js";
import {
  getChannelOverride,
  getGuildSettings,
  getWhitelist,
} from "./settings.js";
import { scanMessage, type ViolationReason } from "./messageScanner.js";

const REASON_LABELS: Record<ViolationReason, string> = {
  link: "Tautan/URL",
  image: "Gambar",
  attachment: "File lampiran",
};

function formatReasons(reasons: ViolationReason[]): string {
  return reasons.map((r) => REASON_LABELS[r]).join(", ");
}

export async function handleMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  if (message.author.bot) return;
  if (message.system) return;

  const guildId = message.guildId;
  const channelId = message.channelId;

  let settings;
  try {
    settings = await getGuildSettings(guildId);
  } catch (err) {
    logger.error({ err, guildId }, "Failed to load guild settings");
    return;
  }

  if (!settings.enabled) return;

  const override = await getChannelOverride(guildId, channelId);
  if (override?.mode === "ignore") return;

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

  if (!rules.deleteLinks && !rules.deleteImages && !rules.deleteAttachments) return;

  const member = message.member;
  if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const whitelist = await getWhitelist(guildId);
  if (whitelist.length > 0) {
    for (const entry of whitelist) {
      if (entry.targetType === "user" && entry.targetId === message.author.id) return;
      if (entry.targetType === "role" && member?.roles.cache.has(entry.targetId)) return;
    }
  }

  const reasons = scanMessage(message, rules);
  if (reasons.length === 0) return;

  const me = message.guild.members.me;
  if (!me || !message.channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
    logger.warn({ guildId, channelId }, "Missing Manage Messages permission, cannot delete");
    return;
  }

  try {
    await message.delete();
  } catch (err) {
    logger.error({ err, messageId: message.id }, "Failed to delete message");
    return;
  }

  const reasonLabel = formatReasons(reasons);
  const snippet = (message.content ?? "").slice(0, 200);

  try {
    await db.insert(deletionLogsTable).values({
      guildId,
      channelId,
      userId: message.author.id,
      reason: reasonLabel,
      contentSnippet: snippet || null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to log deletion");
  }

  if (settings.warnUser) {
    const warnText = settings.warnMessage
      .replaceAll("{user}", `<@${message.author.id}>`)
      .replaceAll("{reason}", reasonLabel);

    if (
      message.channel.type === ChannelType.GuildText ||
      message.channel.type === ChannelType.GuildAnnouncement ||
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread ||
      message.channel.type === ChannelType.AnnouncementThread
    ) {
      try {
        const sent = await message.channel.send({
          content: warnText,
          allowedMentions: { users: [message.author.id] },
        });
        if (settings.warnDeleteAfterMs > 0) {
          setTimeout(() => { sent.delete().catch(() => {}); }, settings.warnDeleteAfterMs);
        }
      } catch (err) {
        logger.error({ err }, "Failed to send warn message");
      }
    }
  }

  if (settings.dmUser) {
    try {
      await message.author.send({
        content: `Pesan Anda di **${message.guild.name}** (#${
          "name" in message.channel ? message.channel.name : "channel"
        }) telah dihapus karena: ${reasonLabel}.`,
      });
    } catch {}
  }

  if (settings.logChannelId) {
    try {
      const logChannel = await message.guild.channels.fetch(settings.logChannelId);
      if (logChannel && logChannel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle("Pesan dihapus")
          .setColor(0xed4245)
          .addFields(
            { name: "User", value: `<@${message.author.id}> (\`${message.author.tag}\`)`, inline: true },
            { name: "Channel", value: `<#${channelId}>`, inline: true },
            { name: "Alasan", value: reasonLabel, inline: false },
          )
          .setTimestamp(new Date());
        if (snippet) {
          embed.addFields({
            name: "Konten",
            value: snippet.length > 1000 ? snippet.slice(0, 1000) + "…" : snippet,
          });
        }
        if (message.attachments.size > 0) {
          const list = Array.from(message.attachments.values())
            .map((a) => a.url).slice(0, 5).join("\n");
          embed.addFields({ name: "Lampiran (URL)", value: list });
        }
        await (logChannel as TextChannel).send({ embeds: [embed] });
      }
    } catch (err) {
      logger.error({ err }, "Failed to send log message");
    }
  }
}

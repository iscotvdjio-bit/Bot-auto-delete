import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { channelOverridesTable } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { getGuildSettings, getWhitelist } from "../settings.js";

const onOff = (b: boolean) => (b ? "✅ Aktif" : "❌ Nonaktif");

export async function handleStatus(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;

  const settings = await getGuildSettings(guildId);
  const overrides = await db.select().from(channelOverridesTable)
    .where(eq(channelOverridesTable.guildId, guildId));
  const whitelist = await getWhitelist(guildId);

  const userCount = whitelist.filter((w) => w.targetType === "user").length;
  const roleCount = whitelist.filter((w) => w.targetType === "role").length;

  const overrideText = overrides.length === 0
    ? "_Tidak ada_"
    : overrides.map((o) =>
        `<#${o.channelId}> → ${
          o.mode === "ignore" ? "diabaikan" : o.mode === "strict" ? "ketat" : "kustom"
        }`,
      ).join("\n");

  const embed = new EmbedBuilder()
    .setColor(settings.enabled ? 0x57f287 : 0xed4245)
    .setTitle(`Status Bot — ${interaction.guild?.name ?? "Server"}`)
    .addFields(
      { name: "Status global", value: settings.enabled ? "✅ Aktif" : "❌ Nonaktif", inline: true },
      { name: "Log channel", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "_Tidak diset_", inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "Hapus link", value: onOff(settings.deleteLinks), inline: true },
      { name: "Hapus gambar", value: onOff(settings.deleteImages), inline: true },
      { name: "Hapus file lain", value: onOff(settings.deleteAttachments), inline: true },
      { name: "Peringatan di channel", value: onOff(settings.warnUser), inline: true },
      { name: "DM ke pelanggar", value: onOff(settings.dmUser), inline: true },
      { name: "Auto-hapus peringatan", value: settings.warnDeleteAfterMs > 0 ? `${settings.warnDeleteAfterMs} ms` : "Tidak", inline: true },
      { name: `Whitelist (${userCount + roleCount})`, value: `${userCount} user, ${roleCount} role`, inline: false },
      { name: `Override channel (${overrides.length})`, value: overrideText, inline: false },
    )
    .setFooter({ text: "Gunakan /help untuk daftar perintah" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { channelOverridesTable } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { getGuildSettings, getWhitelist } from "../settings.js";

const onOff = (b: boolean) => (b ? "✅ Aktif" : "❌ Nonaktif");

export async function handleStatus(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;

  const settings = await getGuildSettings(guildId);
  const overrides = await db.select().from(channelOverridesTable)
    .where(eq(channelOverridesTable.guildId, guildId));
  const whitelist = await getWhitelist(guildId);

  const userCount = whitelist.filter((w) => w.targetType === "user").length;
  const roleCount = whitelist.filter((w) => w.targetType === "role").length;

  const overrideText = overrides.length === 0
    ? "_Tidak ada_"
    : overrides.map((o) =>
        `<#${o.channelId}> → ${
          o.mode === "ignore" ? "diabaikan" : o.mode === "strict" ? "ketat" : "kustom"
        }`,
      ).join("\n");

  const embed = new EmbedBuilder()
    .setColor(settings.enabled ? 0x57f287 : 0xed4245)
    .setTitle(`Status Bot — ${interaction.guild?.name ?? "Server"}`)
    .addFields(
      { name: "Status global", value: settings.enabled ? "✅ Aktif" : "❌ Nonaktif", inline: true },
      { name: "Log channel", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "_Tidak diset_", inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "Hapus link", value: onOff(settings.deleteLinks), inline: true },
      { name: "Hapus gambar", value: onOff(settings.deleteImages), inline: true },
      { name: "Hapus file lain", value: onOff(settings.deleteAttachments), inline: true },
      { name: "Peringatan di channel", value: onOff(settings.warnUser), inline: true },
      { name: "DM ke pelanggar", value: onOff(settings.dmUser), inline: true },
      { name: "Auto-hapus peringatan", value: settings.warnDeleteAfterMs > 0 ? `${settings.warnDeleteAfterMs} ms` : "Tidak", inline: true },
      { name: `Whitelist (${userCount + roleCount})`, value: `${userCount} user, ${roleCount} role`, inline: false },
      { name: `Override channel (${overrides.length})`, value: overrideText, inline: false },
    )
    .setFooter({ text: "Gunakan /help untuk daftar perintah" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

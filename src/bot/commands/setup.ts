import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import {
  channelOverridesTable,
  guildSettingsTable,
  whitelistTable,
} from "../../db/index.js";
import { eq } from "drizzle-orm";
import { clearGuildCache, updateGuildSettings } from "../settings.js";

export async function handleSetup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "enable") {
    await updateGuildSettings(guildId, { enabled: true });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("Bot diaktifkan")
        .setDescription("Auto-delete sekarang aktif. Gunakan `/config` untuk menyesuaikan apa yang dihapus.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "disable") {
    await updateGuildSettings(guildId, { enabled: false });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle("Bot dinonaktifkan")
        .setDescription("Auto-delete sekarang nonaktif di server ini.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "reset") {
    await db.delete(channelOverridesTable).where(eq(channelOverridesTable.guildId, guildId));
    await db.delete(whitelistTable).where(eq(whitelistTable.guildId, guildId));
    await db.delete(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId));
    clearGuildCache(guildId);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle("Pengaturan direset")
        .setDescription("Semua pengaturan, override channel, dan whitelist telah dihapus.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

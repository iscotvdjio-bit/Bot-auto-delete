import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { updateGuildSettings } from "../settings.js";

export async function handleConfig(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "links") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await updateGuildSettings(guildId, { deleteLinks: enabled });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Pengaturan link diperbarui")
        .setDescription(`Penghapusan link sekarang **${enabled ? "AKTIF" : "NONAKTIF"}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "images") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await updateGuildSettings(guildId, { deleteImages: enabled });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Pengaturan gambar diperbarui")
        .setDescription(`Penghapusan gambar sekarang **${enabled ? "AKTIF" : "NONAKTIF"}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "attachments") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await updateGuildSettings(guildId, { deleteAttachments: enabled });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Pengaturan lampiran diperbarui")
        .setDescription(`Penghapusan file lampiran (non-gambar) sekarang **${enabled ? "AKTIF" : "NONAKTIF"}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "warn") {
    const enabled = interaction.options.getBoolean("enabled", true);
    const message = interaction.options.getString("message");
    const deleteAfter = interaction.options.getInteger("delete_after_ms");

    const patch: Record<string, unknown> = { warnUser: enabled };
    if (message) patch.warnMessage = message;
    if (deleteAfter !== null) patch.warnDeleteAfterMs = deleteAfter;

    await updateGuildSettings(guildId, patch);

    await interaction.reply({
      embeds: [
        new EmbedBuilder().setColor(0x5865f2).setTitle("Pesan peringatan diperbarui")
          .addFields(
            { name: "Status", value: enabled ? "Aktif" : "Nonaktif", inline: true },
            ...(message ? [{ name: "Pesan baru", value: message, inline: false }] : []),
            ...(deleteAfter !== null
              ? [{ name: "Hapus setelah", value: deleteAfter === 0 ? "Tidak dihapus" : `${deleteAfter} ms`, inline: true }]
              : []),
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "dm") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await updateGuildSettings(guildId, { dmUser: enabled });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Pengaturan DM diperbarui")
        .setDescription(`DM peringatan ke user pelanggar sekarang **${enabled ? "AKTIF" : "NONAKTIF"}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

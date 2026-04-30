import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { removeChannelOverride, setChannelOverride } from "../settings.js";

const ALLOWED_CHANNEL_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
  ChannelType.GuildForum,
]);

export async function handleChannel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  const channel = interaction.options.getChannel("channel") ?? interaction.channel;
  if (!channel || !("id" in channel)) {
    await interaction.reply({ content: "Channel tidak ditemukan.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!ALLOWED_CHANNEL_TYPES.has(channel.type)) {
    await interaction.reply({ content: "Tipe channel tidak didukung.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === "ignore") {
    await setChannelOverride(guildId, channel.id, { mode: "ignore" });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle("Channel diabaikan")
        .setDescription(`Bot tidak akan menghapus apa pun di <#${channel.id}>.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "strict") {
    await setChannelOverride(guildId, channel.id, { mode: "strict" });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle("Mode ketat aktif")
        .setDescription(`Bot akan menghapus **semua link, gambar, dan file** di <#${channel.id}>.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "reset") {
    const removed = await removeChannelOverride(guildId, channel.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(removed ? 0x57f287 : 0x99aab5)
        .setTitle(removed ? "Override dihapus" : "Tidak ada override")
        .setDescription(removed
          ? `<#${channel.id}> sekarang mengikuti pengaturan server.`
          : `<#${channel.id}> sudah memakai pengaturan server.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

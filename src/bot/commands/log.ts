import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { updateGuildSettings } from "../settings.js";

const TEXT_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
]);

export async function handleLog(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "set") {
    const channel = interaction.options.getChannel("channel", true);
    if (!("id" in channel) || !TEXT_TYPES.has(channel.type)) {
      await interaction.reply({ content: "Pilih text channel biasa.", flags: MessageFlags.Ephemeral });
      return;
    }

    const me = interaction.guild?.members.me;
    const perms = interaction.guild?.channels.cache.get(channel.id)?.permissionsFor(me!);
    if (perms && (!perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.ViewChannel))) {
      await interaction.reply({
        content: `Bot tidak punya izin untuk mengirim pesan di <#${channel.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await updateGuildSettings(guildId, { logChannelId: channel.id });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("Log channel ditetapkan")
        .setDescription(`Setiap penghapusan akan dicatat di <#${channel.id}>.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "clear") {
    await updateGuildSettings(guildId, { logChannelId: null });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle("Log channel dimatikan")
        .setDescription("Penghapusan tidak akan dicatat ke channel mana pun.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

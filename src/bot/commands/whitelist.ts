import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { addWhitelist, getWhitelist, removeWhitelist } from "../settings.js";

export async function handleWhitelist(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) return;
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  if (sub === "add-user") {
    const user = interaction.options.getUser("user", true);
    await addWhitelist(guildId, "user", user.id, interaction.user.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("User ditambahkan ke whitelist")
        .setDescription(`<@${user.id}> bebas mengirim link/gambar.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "add-role") {
    const role = interaction.options.getRole("role", true);
    await addWhitelist(guildId, "role", role.id, interaction.user.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("Role ditambahkan ke whitelist")
        .setDescription(`<@&${role.id}> bebas mengirim link/gambar.`)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === "remove-user") {
    const user = interaction.options.getUser("user", true);
    const removed = await removeWhitelist(guildId, "user", user.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(removed ? 0xfee75c : 0x99aab5)
        .setTitle(removed ? "User dihapus dari whitelist" : "User tidak ada di whitelist")
        .setDescription(`<@${user.id}>`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "remove-role") {
    const role = interaction.options.getRole("role", true);
    const removed = await removeWhitelist(guildId, "role", role.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(removed ? 0xfee75c : 0x99aab5)
        .setTitle(removed ? "Role dihapus dari whitelist" : "Role tidak ada di whitelist")
        .setDescription(`<@&${role.id}>`)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (sub === "list") {
    const list = await getWhitelist(guildId);
    if (list.length === 0) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x99aab5).setTitle("Whitelist kosong")
          .setDescription("Belum ada user atau role yang di-whitelist. Gunakan `/whitelist add-user` atau `/whitelist add-role` untuk menambahkan.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const users = list.filter((e) => e.targetType === "user").map((e) => `<@${e.targetId}>`).join(", ");
    const roles = list.filter((e) => e.targetType === "role").map((e) => `<@&${e.targetId}>`).join(", ");

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`Whitelist (${list.length})`);
    if (users) embed.addFields({ name: "Users", value: users });
    if (roles) embed.addFields({ name: "Roles", value: roles });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }
}

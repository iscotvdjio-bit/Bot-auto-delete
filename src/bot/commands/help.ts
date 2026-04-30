import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";

export async function handleHelp(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Panduan Auto-Delete Bot")
    .setDescription("Bot ini otomatis menghapus pesan yang berisi link, gambar, atau lampiran sesuai pengaturan server. Member dengan permission **Manage Messages** otomatis dikecualikan.")
    .addFields(
      { name: "🔧 Setup", value:
        "`/setup enable` — aktifkan bot\n" +
        "`/setup disable` — nonaktifkan bot\n" +
        "`/setup reset` — reset semua pengaturan" },
      { name: "⚙️ Konfigurasi", value:
        "`/config links <on/off>` — hapus link\n" +
        "`/config images <on/off>` — hapus gambar\n" +
        "`/config attachments <on/off>` — hapus file non-gambar\n" +
        "`/config warn <on/off> [message] [delete_after_ms]` — pesan peringatan\n" +
        "`/config dm <on/off>` — DM ke user pelanggar" },
      { name: "📺 Per-Channel", value:
        "`/channel ignore [channel]` — abaikan channel\n" +
        "`/channel strict [channel]` — hapus semuanya\n" +
        "`/channel reset [channel]` — kembalikan ke default" },
      { name: "✅ Whitelist", value:
        "`/whitelist add-user <user>` — bebaskan user\n" +
        "`/whitelist add-role <role>` — bebaskan role\n" +
        "`/whitelist remove-user <user>`\n" +
        "`/whitelist remove-role <role>`\n" +
        "`/whitelist list`" },
      { name: "📝 Log", value:
        "`/log set <channel>` — set channel log\n" +
        "`/log clear` — matikan log" },
      { name: "🧹 Bersih-bersih", value:
        "`/scan-history <amount> [channel]` — pindai dan hapus link/gambar lama (maks 1000 pesan)" },
      { name: "ℹ️ Lain-lain", value: "`/status` — lihat pengaturan saat ini\n`/help` — pesan ini" },
      { name: "Placeholder pesan peringatan", value: "`{user}` → mention user, `{reason}` → alasan penghapusan" },
    )
    .setFooter({ text: "Pastikan bot punya permission Manage Messages di channel target." });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

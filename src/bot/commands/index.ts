import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { handleSetup } from "./setup.js";
import { handleConfig } from "./config.js";
import { handleChannel } from "./channel.js";
import { handleWhitelist } from "./whitelist.js";
import { handleLog } from "./log.js";
import { handleStatus } from "./status.js";
import { handleHelp } from "./help.js";
import { handleScanHistory } from "./scanHistory.js";

export interface SlashCommand {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const setupCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Aktifkan, nonaktifkan, atau reset bot di server ini")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("enable").setDescription("Aktifkan auto-delete di server ini"))
    .addSubcommand((s) => s.setName("disable").setDescription("Nonaktifkan auto-delete di server ini"))
    .addSubcommand((s) => s.setName("reset").setDescription("Reset semua pengaturan ke default"))
    .toJSON(),
  execute: handleSetup,
};

const configCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Atur apa saja yang dihapus oleh bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("links").setDescription("Aktifkan/nonaktifkan penghapusan link")
      .addBooleanOption((o) => o.setName("enabled").setDescription("Hapus link?").setRequired(true)))
    .addSubcommand((s) => s.setName("images").setDescription("Aktifkan/nonaktifkan penghapusan gambar")
      .addBooleanOption((o) => o.setName("enabled").setDescription("Hapus gambar?").setRequired(true)))
    .addSubcommand((s) => s.setName("attachments").setDescription("Aktifkan/nonaktifkan penghapusan file lampiran")
      .addBooleanOption((o) => o.setName("enabled").setDescription("Hapus file?").setRequired(true)))
    .addSubcommand((s) => s.setName("warn").setDescription("Atur pesan peringatan")
      .addBooleanOption((o) => o.setName("enabled").setDescription("Kirim pesan peringatan saat menghapus?").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Pesan kustom (placeholder: {user}, {reason}). Kosongkan untuk default").setRequired(false))
      .addIntegerOption((o) => o.setName("delete_after_ms").setDescription("Hapus pesan peringatan setelah ms (0 = jangan hapus)").setMinValue(0).setMaxValue(60000).setRequired(false)))
    .addSubcommand((s) => s.setName("dm").setDescription("Aktifkan/nonaktifkan DM peringatan ke user yang melanggar")
      .addBooleanOption((o) => o.setName("enabled").setDescription("Kirim DM?").setRequired(true)))
    .toJSON(),
  execute: handleConfig,
};

const channelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("channel")
    .setDescription("Atur perilaku per-channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("ignore").setDescription("Bot akan mengabaikan channel ini")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel target (default: channel saat ini)").setRequired(false)))
    .addSubcommand((s) => s.setName("strict").setDescription("Hapus semua link, gambar, dan file di channel ini")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel target (default: channel saat ini)").setRequired(false)))
    .addSubcommand((s) => s.setName("reset").setDescription("Hapus override channel (kembali ke pengaturan server)")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel target (default: channel saat ini)").setRequired(false)))
    .toJSON(),
  execute: handleChannel,
};

const whitelistCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("whitelist")
    .setDescription("Kelola whitelist user dan role")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("add-user").setDescription("Tambahkan user ke whitelist")
      .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)))
    .addSubcommand((s) => s.setName("add-role").setDescription("Tambahkan role ke whitelist")
      .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)))
    .addSubcommand((s) => s.setName("remove-user").setDescription("Hapus user dari whitelist")
      .addUserOption((o) => o.setName("user").setDescription("User").setRequired(true)))
    .addSubcommand((s) => s.setName("remove-role").setDescription("Hapus role dari whitelist")
      .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true)))
    .addSubcommand((s) => s.setName("list").setDescription("Lihat semua whitelist"))
    .toJSON(),
  execute: handleWhitelist,
};

const logCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("Atur log channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("set").setDescription("Tetapkan channel sebagai log channel")
      .addChannelOption((o) => o.setName("channel").setDescription("Channel log").setRequired(true)))
    .addSubcommand((s) => s.setName("clear").setDescription("Matikan log channel"))
    .toJSON(),
  execute: handleLog,
};

const statusCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("status").setDescription("Lihat pengaturan bot saat ini").setDMPermission(false).toJSON(),
  execute: handleStatus,
};

const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help").setDescription("Tampilkan daftar perintah dan cara pakai").setDMPermission(false).toJSON(),
  execute: handleHelp,
};

const scanHistoryCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("scan-history")
    .setDescription("Pindai dan hapus link/gambar dari riwayat channel (bersih-bersih)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
    .setDMPermission(false)
    .addIntegerOption((o) => o.setName("amount").setDescription("Jumlah pesan terakhir untuk dipindai (1-1000)").setMinValue(1).setMaxValue(1000).setRequired(true))
    .addChannelOption((o) => o.setName("channel").setDescription("Channel target (default: channel saat ini)").setRequired(false))
    .toJSON(),
  execute: handleScanHistory,
};

export const commands: SlashCommand[] = [
  setupCommand, configCommand, channelCommand, whitelistCommand,
  logCommand, statusCommand, helpCommand, scanHistoryCommand,
];

export const commandsByName = new Map<string, SlashCommand>(
  commands.map((c) => [c.data.name, c]),
);

import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const guildSettingsTable = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  deleteLinks: boolean("delete_links").notNull().default(true),
  deleteImages: boolean("delete_images").notNull().default(true),
  deleteAttachments: boolean("delete_attachments").notNull().default(false),
  warnUser: boolean("warn_user").notNull().default(true),
  dmUser: boolean("dm_user").notNull().default(false),
  warnMessage: text("warn_message").notNull().default(
    "Maaf {user}, pesan Anda dihapus karena mengandung konten yang tidak diizinkan ({reason}).",
  ),
  warnDeleteAfterMs: integer("warn_delete_after_ms").notNull().default(5000),
  logChannelId: text("log_channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GuildSettings = typeof guildSettingsTable.$inferSelect;
export type InsertGuildSettings = typeof guildSettingsTable.$inferInsert;

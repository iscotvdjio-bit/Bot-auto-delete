import {
  pgTable,
  text,
  timestamp,
  serial,
  index,
} from "drizzle-orm/pg-core";

export const deletionLogsTable = pgTable(
  "deletion_logs",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    userId: text("user_id").notNull(),
    reason: text("reason").notNull(),
    contentSnippet: text("content_snippet"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deletion_logs_guild_idx").on(table.guildId, table.createdAt),
  ],
);

export type DeletionLog = typeof deletionLogsTable.$inferSelect;
export type InsertDeletionLog = typeof deletionLogsTable.$inferInsert;

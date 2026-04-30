import {
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const whitelistTable = pgTable(
  "whitelist",
  {
    guildId: text("guild_id").notNull(),
    targetType: text("target_type", { enum: ["user", "role"] }).notNull(),
    targetId: text("target_id").notNull(),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.guildId, table.targetType, table.targetId],
    }),
  ],
);

export type WhitelistEntry = typeof whitelistTable.$inferSelect;
export type InsertWhitelistEntry = typeof whitelistTable.$inferInsert;

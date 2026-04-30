import {
  pgTable,
  text,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const channelOverridesTable = pgTable(
  "channel_overrides",
  {
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    mode: text("mode", { enum: ["ignore", "strict", "default"] })
      .notNull()
      .default("default"),
    deleteLinks: boolean("delete_links"),
    deleteImages: boolean("delete_images"),
    deleteAttachments: boolean("delete_attachments"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.channelId] })],
);

export type ChannelOverride = typeof channelOverridesTable.$inferSelect;
export type InsertChannelOverride = typeof channelOverridesTable.$inferInsert;

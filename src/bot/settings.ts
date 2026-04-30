import { db } from "../db/index.js";
import {
  guildSettingsTable,
  channelOverridesTable,
  whitelistTable,
  type GuildSettings,
  type ChannelOverride,
  type WhitelistEntry,
} from "../db/index.js";
import { and, eq } from "drizzle-orm";

const guildCache = new Map<string, GuildSettings>();
const overrideCache = new Map<string, Map<string, ChannelOverride>>();
const whitelistCache = new Map<string, WhitelistEntry[]>();

export async function getGuildSettings(
  guildId: string,
): Promise<GuildSettings> {
  const cached = guildCache.get(guildId);
  if (cached) return cached;

  const rows = await db
    .select()
    .from(guildSettingsTable)
    .where(eq(guildSettingsTable.guildId, guildId))
    .limit(1);

  let settings = rows[0];
  if (!settings) {
    const inserted = await db
      .insert(guildSettingsTable)
      .values({ guildId })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) {
      settings = inserted[0];
    } else {
      const reread = await db
        .select()
        .from(guildSettingsTable)
        .where(eq(guildSettingsTable.guildId, guildId))
        .limit(1);
      settings = reread[0]!;
    }
  }

  guildCache.set(guildId, settings);
  return settings;
}

export async function updateGuildSettings(
  guildId: string,
  patch: Partial<Omit<GuildSettings, "guildId" | "createdAt">>,
): Promise<GuildSettings> {
  await getGuildSettings(guildId);

  const [updated] = await db
    .update(guildSettingsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(guildSettingsTable.guildId, guildId))
    .returning();

  guildCache.set(guildId, updated!);
  return updated!;
}

async function loadOverrides(guildId: string) {
  const rows = await db
    .select()
    .from(channelOverridesTable)
    .where(eq(channelOverridesTable.guildId, guildId));
  const map = new Map<string, ChannelOverride>();
  for (const row of rows) map.set(row.channelId, row);
  overrideCache.set(guildId, map);
  return map;
}

export async function getChannelOverride(
  guildId: string,
  channelId: string,
): Promise<ChannelOverride | undefined> {
  let map = overrideCache.get(guildId);
  if (!map) map = await loadOverrides(guildId);
  return map.get(channelId);
}

export async function setChannelOverride(
  guildId: string,
  channelId: string,
  patch: Partial<Omit<ChannelOverride, "guildId" | "channelId" | "createdAt">>,
): Promise<ChannelOverride> {
  const existing = await getChannelOverride(guildId, channelId);

  let result: ChannelOverride;
  if (existing) {
    const [updated] = await db
      .update(channelOverridesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(channelOverridesTable.guildId, guildId),
          eq(channelOverridesTable.channelId, channelId),
        ),
      )
      .returning();
    result = updated!;
  } else {
    const [inserted] = await db
      .insert(channelOverridesTable)
      .values({ guildId, channelId, ...patch })
      .returning();
    result = inserted!;
  }

  let map = overrideCache.get(guildId);
  if (!map) {
    map = new Map();
    overrideCache.set(guildId, map);
  }
  map.set(channelId, result);
  return result;
}

export async function removeChannelOverride(
  guildId: string,
  channelId: string,
): Promise<boolean> {
  const result = await db
    .delete(channelOverridesTable)
    .where(
      and(
        eq(channelOverridesTable.guildId, guildId),
        eq(channelOverridesTable.channelId, channelId),
      ),
    )
    .returning();

  const map = overrideCache.get(guildId);
  if (map) map.delete(channelId);
  return result.length > 0;
}

async function loadWhitelist(guildId: string) {
  const rows = await db
    .select()
    .from(whitelistTable)
    .where(eq(whitelistTable.guildId, guildId));
  whitelistCache.set(guildId, rows);
  return rows;
}

export async function getWhitelist(
  guildId: string,
): Promise<WhitelistEntry[]> {
  const cached = whitelistCache.get(guildId);
  if (cached) return cached;
  return loadWhitelist(guildId);
}

export async function addWhitelist(
  guildId: string,
  targetType: "user" | "role",
  targetId: string,
  addedBy: string,
): Promise<WhitelistEntry> {
  const [inserted] = await db
    .insert(whitelistTable)
    .values({ guildId, targetType, targetId, addedBy })
    .onConflictDoNothing()
    .returning();

  await loadWhitelist(guildId);

  if (inserted) return inserted;
  const list = await getWhitelist(guildId);
  return list.find(
    (w) => w.targetType === targetType && w.targetId === targetId,
  )!;
}

export async function removeWhitelist(
  guildId: string,
  targetType: "user" | "role",
  targetId: string,
): Promise<boolean> {
  const removed = await db
    .delete(whitelistTable)
    .where(
      and(
        eq(whitelistTable.guildId, guildId),
        eq(whitelistTable.targetType, targetType),
        eq(whitelistTable.targetId, targetId),
      ),
    )
    .returning();

  await loadWhitelist(guildId);
  return removed.length > 0;
}

export function clearGuildCache(guildId: string) {
  guildCache.delete(guildId);
  overrideCache.delete(guildId);
  whitelistCache.delete(guildId);
}

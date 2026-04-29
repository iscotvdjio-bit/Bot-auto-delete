const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Buat folder data jika belum ada (penting untuk Railway)
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new BetterSqlite3(path.join(dataDir, 'automod.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Buat Tabel ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id      TEXT PRIMARY KEY,
    log_channel   TEXT,
    warn_user     INTEGER DEFAULT 0,
    delete_links  INTEGER DEFAULT 0,
    delete_images INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS channel_config (
    channel_id    TEXT PRIMARY KEY,
    guild_id      TEXT NOT NULL,
    delete_links  INTEGER DEFAULT 0,
    delete_images INTEGER DEFAULT 0,
    whitelist     TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS allowed_roles (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id  TEXT NOT NULL,
    role_id   TEXT NOT NULL,
    UNIQUE(guild_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS delete_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    reason      TEXT,
    content     TEXT,
    deleted_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ── Guild Config ──────────────────────────────────────────────────────────────
function getGuild(guildId) {
  return db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
}

function upsertGuild(guildId, fields = {}) {
  const existing = getGuild(guildId);
  if (!existing) {
    db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(guildId);
  }
  for (const [key, value] of Object.entries(fields)) {
    db.prepare(`UPDATE guild_config SET ${key} = ? WHERE guild_id = ?`).run(value, guildId);
  }
}

function deleteGuild(guildId) {
  db.prepare('DELETE FROM guild_config WHERE guild_id = ?').run(guildId);
}

// ── Channel Config ────────────────────────────────────────────────────────────
function getChannel(channelId) {
  return db.prepare('SELECT * FROM channel_config WHERE channel_id = ?').get(channelId);
}

function upsertChannel(channelId, guildId, fields = {}) {
  const existing = getChannel(channelId);
  if (!existing) {
    db.prepare('INSERT INTO channel_config (channel_id, guild_id) VALUES (?, ?)').run(channelId, guildId);
  }
  for (const [key, value] of Object.entries(fields)) {
    db.prepare(`UPDATE channel_config SET ${key} = ? WHERE channel_id = ?`).run(value, channelId);
  }
}

function getAllChannels(guildId) {
  return db.prepare('SELECT * FROM channel_config WHERE guild_id = ?').all(guildId);
}

// ── Whitelist ─────────────────────────────────────────────────────────────────
function addWhitelist(channelId, guildId, domain) {
  const row = getChannel(channelId);
  const domains = new Set(row?.whitelist ? row.whitelist.split(',').filter(Boolean) : []);
  domains.add(domain.toLowerCase());
  upsertChannel(channelId, guildId, { whitelist: [...domains].join(',') });
}

function removeWhitelist(channelId, guildId, domain) {
  const row = getChannel(channelId);
  if (!row) return;
  const domains = new Set(row.whitelist ? row.whitelist.split(',').filter(Boolean) : []);
  domains.delete(domain.toLowerCase());
  upsertChannel(channelId, guildId, { whitelist: [...domains].join(',') });
}

// ── Allowed Roles ─────────────────────────────────────────────────────────────
function addRole(guildId, roleId) {
  db.prepare('INSERT OR IGNORE INTO allowed_roles (guild_id, role_id) VALUES (?, ?)').run(guildId, roleId);
}

function removeRole(guildId, roleId) {
  db.prepare('DELETE FROM allowed_roles WHERE guild_id = ? AND role_id = ?').run(guildId, roleId);
}

function getRoles(guildId) {
  return db.prepare('SELECT role_id FROM allowed_roles WHERE guild_id = ?').all(guildId).map(r => r.role_id);
}

// ── Delete Log ────────────────────────────────────────────────────────────────
function logDelete(guildId, channelId, userId, reason, content) {
  db.prepare(
    'INSERT INTO delete_log (guild_id, channel_id, user_id, reason, content) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, channelId, userId, reason, (content || '').slice(0, 1000));
}

function getLog(guildId, limit = 10) {
  return db.prepare(
    'SELECT * FROM delete_log WHERE guild_id = ? ORDER BY deleted_at DESC LIMIT ?'
  ).all(guildId, limit);
}

module.exports = {
  getGuild, upsertGuild, deleteGuild,
  getChannel, upsertChannel, getAllChannels,
  addWhitelist, removeWhitelist,
  addRole, removeRole, getRoles,
  logDelete, getLog,
};

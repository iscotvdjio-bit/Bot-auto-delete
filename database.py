import aiosqlite
import logging
from typing import Optional

log = logging.getLogger("AutoMod.DB")
DB_PATH = "automod.db"


class Database:
    """Async SQLite wrapper for guild/channel configuration."""

    def __init__(self):
        self._conn: Optional[aiosqlite.Connection] = None

    async def init(self):
        self._conn = await aiosqlite.connect(DB_PATH)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA journal_mode=WAL")
        await self._create_tables()
        log.info("Database initialised")

    async def _create_tables(self):
        await self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS guild_config (
                guild_id      INTEGER PRIMARY KEY,
                log_channel   INTEGER,
                warn_user     INTEGER DEFAULT 0,
                delete_links  INTEGER DEFAULT 0,
                delete_images INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS channel_config (
                channel_id    INTEGER PRIMARY KEY,
                guild_id      INTEGER NOT NULL,
                delete_links  INTEGER DEFAULT 0,
                delete_images INTEGER DEFAULT 0,
                whitelist     TEXT DEFAULT '',
                FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id)
                    ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS allowed_roles (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id   INTEGER NOT NULL,
                role_id    INTEGER NOT NULL,
                UNIQUE(guild_id, role_id)
            );

            CREATE TABLE IF NOT EXISTS delete_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id    INTEGER NOT NULL,
                channel_id  INTEGER NOT NULL,
                user_id     INTEGER NOT NULL,
                reason      TEXT,
                content     TEXT,
                deleted_at  TEXT DEFAULT (datetime('now'))
            );
        """)
        await self._conn.commit()

    # ── Guild Config ──────────────────────────────────────────────────────────
    async def get_guild(self, guild_id: int) -> Optional[aiosqlite.Row]:
        async with self._conn.execute(
            "SELECT * FROM guild_config WHERE guild_id = ?", (guild_id,)
        ) as cur:
            return await cur.fetchone()

    async def upsert_guild(self, guild_id: int, **kwargs):
        existing = await self.get_guild(guild_id)
        if not existing:
            await self._conn.execute(
                "INSERT INTO guild_config (guild_id) VALUES (?)", (guild_id,)
            )
        if kwargs:
            sets = ", ".join(f"{k} = ?" for k in kwargs)
            vals = list(kwargs.values()) + [guild_id]
            await self._conn.execute(
                f"UPDATE guild_config SET {sets} WHERE guild_id = ?", vals
            )
        await self._conn.commit()

    async def delete_guild(self, guild_id: int):
        await self._conn.execute(
            "DELETE FROM guild_config WHERE guild_id = ?", (guild_id,)
        )
        await self._conn.commit()

    # ── Channel Config ────────────────────────────────────────────────────────
    async def get_channel(self, channel_id: int) -> Optional[aiosqlite.Row]:
        async with self._conn.execute(
            "SELECT * FROM channel_config WHERE channel_id = ?", (channel_id,)
        ) as cur:
            return await cur.fetchone()

    async def upsert_channel(self, channel_id: int, guild_id: int, **kwargs):
        existing = await self.get_channel(channel_id)
        if not existing:
            await self._conn.execute(
                "INSERT INTO channel_config (channel_id, guild_id) VALUES (?, ?)",
                (channel_id, guild_id),
            )
        if kwargs:
            sets = ", ".join(f"{k} = ?" for k in kwargs)
            vals = list(kwargs.values()) + [channel_id]
            await self._conn.execute(
                f"UPDATE channel_config SET {sets} WHERE channel_id = ?", vals
            )
        await self._conn.commit()

    async def get_all_channels(self, guild_id: int):
        async with self._conn.execute(
            "SELECT * FROM channel_config WHERE guild_id = ?", (guild_id,)
        ) as cur:
            return await cur.fetchall()

    # ── Whitelist ─────────────────────────────────────────────────────────────
    async def add_whitelist(self, channel_id: int, guild_id: int, domain: str):
        row = await self.get_channel(channel_id)
        domains = set(row["whitelist"].split(",")) if row and row["whitelist"] else set()
        domains.discard("")
        domains.add(domain.lower())
        await self.upsert_channel(channel_id, guild_id, whitelist=",".join(domains))

    async def remove_whitelist(self, channel_id: int, guild_id: int, domain: str):
        row = await self.get_channel(channel_id)
        if not row:
            return
        domains = set(row["whitelist"].split(","))
        domains.discard(domain.lower())
        domains.discard("")
        await self.upsert_channel(channel_id, guild_id, whitelist=",".join(domains))

    # ── Allowed Roles ─────────────────────────────────────────────────────────
    async def add_role(self, guild_id: int, role_id: int):
        await self._conn.execute(
            "INSERT OR IGNORE INTO allowed_roles (guild_id, role_id) VALUES (?, ?)",
            (guild_id, role_id),
        )
        await self._conn.commit()

    async def remove_role(self, guild_id: int, role_id: int):
        await self._conn.execute(
            "DELETE FROM allowed_roles WHERE guild_id = ? AND role_id = ?",
            (guild_id, role_id),
        )
        await self._conn.commit()

    async def get_roles(self, guild_id: int):
        async with self._conn.execute(
            "SELECT role_id FROM allowed_roles WHERE guild_id = ?", (guild_id,)
        ) as cur:
            rows = await cur.fetchall()
            return [r["role_id"] for r in rows]

    # ── Delete Log ────────────────────────────────────────────────────────────
    async def log_delete(self, guild_id, channel_id, user_id, reason, content):
        await self._conn.execute(
            "INSERT INTO delete_log (guild_id, channel_id, user_id, reason, content) "
            "VALUES (?, ?, ?, ?, ?)",
            (guild_id, channel_id, user_id, reason, content[:1000]),
        )
        await self._conn.commit()

    async def get_log(self, guild_id: int, limit: int = 10):
        async with self._conn.execute(
            "SELECT * FROM delete_log WHERE guild_id = ? "
            "ORDER BY deleted_at DESC LIMIT ?",
            (guild_id, limit),
        ) as cur:
            return await cur.fetchall()

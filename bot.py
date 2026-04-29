import discord
from discord.ext import commands
import asyncio
import logging
import os
from dotenv import load_dotenv
from database import Database

load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("AutoMod")

# ── Bot Setup ─────────────────────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.guilds = True

class AutoModBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix="!",
            intents=intents,
            help_command=None,
            description="🛡️ AutoMod Bot — Auto-delete links & images",
        )
        self.db = Database()

    async def setup_hook(self):
        await self.db.init()
        for cog in ["cogs.automod", "cogs.commands"]:
            await self.load_extension(cog)
            log.info(f"Loaded extension: {cog}")
        synced = await self.tree.sync()
        log.info(f"Synced {len(synced)} slash command(s)")

    async def on_ready(self):
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="🛡️ /automod help"
            )
        )
        log.info(f"Logged in as {self.user} (ID: {self.user.id})")
        log.info(f"Serving {len(self.guilds)} guild(s)")

    async def on_guild_join(self, guild: discord.Guild):
        log.info(f"Joined guild: {guild.name} ({guild.id})")

    async def on_guild_remove(self, guild: discord.Guild):
        await self.db.delete_guild(guild.id)
        log.info(f"Left guild: {guild.name} ({guild.id}) — config cleaned up")


# ── Run ───────────────────────────────────────────────────────────────────────
async def main():
    token = os.getenv("DISCORD_TOKEN")
    if not token:
        log.critical("DISCORD_TOKEN not found in environment variables!")
        return
    async with AutoModBot() as bot:
        await bot.start(token)

if __name__ == "__main__":
    asyncio.run(main())

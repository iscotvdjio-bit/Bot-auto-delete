import re
import discord
from discord.ext import commands
import logging
from urllib.parse import urlparse

log = logging.getLogger("AutoMod.Core")

# ── Regex & Konstanta ──────────────────────────────────────────────────────────
URL_PATTERN = re.compile(
    r"(?:https?://|www\.|ftp://)"
    r"(?:[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+)",
    re.IGNORECASE,
)

IMAGE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".bmp", ".tiff", ".tif", ".svg", ".ico",
}

IMAGE_MIME_PREFIXES = {"image/"}


def extract_domains(text: str) -> list[str]:
    domains = []
    for url in URL_PATTERN.findall(text):
        try:
            parsed = urlparse(url if "://" in url else f"http://{url}")
            host = parsed.hostname or ""
            if host:
                domains.append(host.lower())
        except Exception:
            pass
    return list(set(domains))


def has_link(text: str) -> bool:
    return bool(URL_PATTERN.search(text))


def has_image(message: discord.Message) -> bool:
    for att in message.attachments:
        if any(att.filename.lower().endswith(ext) for ext in IMAGE_EXTENSIONS):
            return True
        if att.content_type and any(
            att.content_type.startswith(p) for p in IMAGE_MIME_PREFIXES
        ):
            return True
    for embed in message.embeds:
        if embed.image or embed.thumbnail:
            return True
    return False


class AutoMod(commands.Cog, name="AutoMod"):
    """Core message monitoring dan auto-delete engine."""

    def __init__(self, bot):
        self.bot = bot
        self.db = bot.db

    async def _get_effective_config(self, guild_id: int, channel_id: int):
        """Gabungkan config guild + channel. Channel override guild."""
        gcfg = await self.db.get_guild(guild_id)
        ccfg = await self.db.get_channel(channel_id)

        delete_links = bool(
            (ccfg and ccfg["delete_links"]) or (gcfg and gcfg["delete_links"])
        )
        delete_images = bool(
            (ccfg and ccfg["delete_images"]) or (gcfg and gcfg["delete_images"])
        )

        whitelist: set[str] = set()
        if ccfg and ccfg["whitelist"]:
            for d in ccfg["whitelist"].split(","):
                d = d.strip()
                if d:
                    whitelist.add(d)

        return delete_links, delete_images, whitelist

    async def _is_exempt(self, member: discord.Member, guild_id: int) -> bool:
        """Admin, bot, dan role whitelist tidak kena filter."""
        if member.bot:
            return True
        if member.guild_permissions.administrator:
            return True
        allowed_roles = set(await self.db.get_roles(guild_id))
        member_roles = {r.id for r in member.roles}
        return bool(allowed_roles & member_roles)

    async def _send_log(self, guild, member, channel, reason, content):
        """Kirim embed log ke channel mod-log yang dikonfigurasi."""
        gcfg = await self.db.get_guild(guild.id)
        if not gcfg or not gcfg["log_channel"]:
            return
        log_ch = guild.get_channel(gcfg["log_channel"])
        if not log_ch:
            return

        embed = discord.Embed(
            title="🗑️ Message Deleted",
            color=discord.Color.red(),
            timestamp=discord.utils.utcnow(),
        )
        embed.set_author(name=str(member), icon_url=member.display_avatar.url)
        embed.add_field(name="Channel", value=channel.mention, inline=True)
        embed.add_field(name="Reason", value=reason, inline=True)
        embed.add_field(name="User ID", value=str(member.id), inline=True)
        if content:
            embed.add_field(
                name="Content",
                value=f"```{content[:900]}```",
                inline=False,
            )
        embed.set_footer(text=f"Guild: {guild.name}")

        try:
            await log_ch.send(embed=embed)
        except discord.Forbidden:
            log.warning(f"Cannot send to log channel in {guild.name}")

    async def _warn_user(self, member: discord.Member, reason: str, channel_name: str):
        """DM user bahwa pesannya dihapus."""
        try:
            embed = discord.Embed(
                title="⚠️ Message Removed",
                description=(
                    f"Your message in **#{channel_name}** was removed.\n"
                    f"**Reason:** {reason}\n\n"
                    "Please review the server rules."
                ),
                color=discord.Color.orange(),
            )
            await member.send(embed=embed)
        except (discord.Forbidden, discord.HTTPException):
            pass

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        await self._check_message(message)

    @commands.Cog.listener()
    async def on_message_edit(self, _before: discord.Message, after: discord.Message):
        await self._check_message(after)

    async def _check_message(self, message: discord.Message):
        if not message.guild or not isinstance(message.author, discord.Member):
            return
        if message.author.bot:
            return

        guild_id = message.guild.id
        channel_id = message.channel.id

        if await self._is_exempt(message.author, guild_id):
            return

        delete_links, delete_images, whitelist = await self._get_effective_config(
            guild_id, channel_id
        )

        reason = None
        content_preview = message.content[:500] if message.content else ""

        # ── Cek Link ───────────────────────────────────────────────────────────
        if delete_links and has_link(message.content):
            domains = extract_domains(message.content)
            blocked = [d for d in domains if d not in whitelist]
            if blocked:
                domains_str = "`, `".join(blocked[:3])
                suffix = "..." if len(blocked) > 3 else ""
                reason = f"Link detected (`{domains_str}`{suffix})"

        # ── Cek Gambar ─────────────────────────────────────────────────────────
        if not reason and delete_images and has_image(message):
            reason = "Image/media not allowed in this channel"

        if not reason:
            return

        # ── Hapus Pesan ────────────────────────────────────────────────────────
        try:
            await message.delete()
            log.info(
                f"[{message.guild.name}] Deleted from "
                f"{message.author} in #{message.channel.name}: {reason}"
            )
        except discord.NotFound:
            return
        except discord.Forbidden:
            log.warning(
                f"Missing permissions in #{message.channel.name} ({message.guild.name})"
            )
            return

        # ── Aksi Setelah Hapus ─────────────────────────────────────────────────
        await self.db.log_delete(
            guild_id, channel_id, message.author.id, reason, content_preview
        )
        await self._send_log(
            message.guild, message.author, message.channel, reason, content_preview
        )

        gcfg = await self.db.get_guild(guild_id)
        if gcfg and gcfg["warn_user"]:
            await self._warn_user(message.author, reason, message.channel.name)


async def setup(bot):
    await bot.add_cog(AutoMod(bot))

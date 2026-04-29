import discord
from discord import app_commands
from discord.ext import commands
import logging

log = logging.getLogger("AutoMod.Commands")


# ── Embed Helpers ─────────────────────────────────────────────────────────────
def ok(title: str, desc: str = "") -> discord.Embed:
    return discord.Embed(title=f"✅ {title}", description=desc, color=0x2ECC71)

def info(title: str, desc: str = "") -> discord.Embed:
    return discord.Embed(title=f"ℹ️ {title}", description=desc, color=0x3498DB)

def err(title: str, desc: str = "") -> discord.Embed:
    return discord.Embed(title=f"❌ {title}", description=desc, color=0xE74C3C)


# ── Cog ───────────────────────────────────────────────────────────────────────
class Commands(commands.Cog, name="Commands"):

    def __init__(self, bot):
        self.bot = bot
        self.db = bot.db

    automod = app_commands.Group(
        name="automod",
        description="🛡️ Manage AutoMod settings",
        default_member_permissions=discord.Permissions(administrator=True),
    )

    # ── /automod status ───────────────────────────────────────────────────────
    @automod.command(name="status", description="Tampilkan konfigurasi AutoMod saat ini")
    async def status(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild
        gcfg  = await self.db.get_guild(guild.id)
        channels = await self.db.get_all_channels(guild.id)
        roles    = await self.db.get_roles(guild.id)

        embed = discord.Embed(title="🛡️ AutoMod Status", color=0x5865F2)
        embed.set_thumbnail(url=guild.icon.url if guild.icon else None)

        g_links  = bool(gcfg["delete_links"])  if gcfg else False
        g_images = bool(gcfg["delete_images"]) if gcfg else False
        g_warn   = bool(gcfg["warn_user"])      if gcfg else False
        g_log    = (
            guild.get_channel(gcfg["log_channel"]).mention
            if gcfg and gcfg["log_channel"] else "Not set"
        )

        embed.add_field(
            name="🌐 Server-wide",
            value=(
                f"**Delete Links:** {'🟢 On' if g_links else '🔴 Off'}\n"
                f"**Delete Images:** {'🟢 On' if g_images else '🔴 Off'}\n"
                f"**Warn Users:** {'🟢 On' if g_warn else '🔴 Off'}\n"
                f"**Log Channel:** {g_log}"
            ),
            inline=False,
        )

        role_mentions = [
            guild.get_role(rid).mention
            for rid in roles if guild.get_role(rid)
        ]
        embed.add_field(
            name="🔓 Exempt Roles",
            value=", ".join(role_mentions) if role_mentions else "None",
            inline=False,
        )

        if channels:
            ch_lines = []
            for ch in channels[:10]:
                channel = guild.get_channel(ch["channel_id"])
                if not channel:
                    continue
                flags = []
                if ch["delete_links"]:  flags.append("🔗 links")
                if ch["delete_images"]: flags.append("🖼️ images")
                wl = [d for d in ch["whitelist"].split(",") if d] if ch["whitelist"] else []
                if wl: flags.append(f"✅ `{', '.join(wl[:3])}`")
                if flags:
                    ch_lines.append(f"{channel.mention}: {' | '.join(flags)}")
            if ch_lines:
                embed.add_field(
                    name="📋 Channel Overrides",
                    value="\n".join(ch_lines),
                    inline=False,
                )

        embed.set_footer(text=f"Guild ID: {guild.id}")
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ── /automod help ─────────────────────────────────────────────────────────
    @automod.command(name="help", description="Tampilkan semua perintah AutoMod")
    async def help_cmd(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="🛡️ AutoMod Bot — Help",
            description="Auto-delete links dan gambar dengan kontrol penuh.",
            color=0x5865F2,
        )
        embed.add_field(
            name="📊 Umum",
            value="`/automod status` — Lihat config\n`/automod log [limit]` — Riwayat hapus",
            inline=False,
        )
        embed.add_field(
            name="🌐 Server-wide `/automod server`",
            value=(
                "`links on/off` — Filter link seluruh server\n"
                "`images on/off` — Filter gambar seluruh server\n"
                "`logchannel #ch` — Set channel mod-log\n"
                "`warn on/off` — DM peringatan ke user"
            ),
            inline=False,
        )
        embed.add_field(
            name="📌 Per Channel `/automod channel`",
            value=(
                "`links #ch on/off` — Filter link di channel\n"
                "`images #ch on/off` — Filter gambar di channel\n"
                "`whitelist_add #ch domain` — Izinkan domain\n"
                "`whitelist_remove #ch domain` — Hapus domain"
            ),
            inline=False,
        )
        embed.add_field(
            name="🔓 Exempt Role `/automod role`",
            value=(
                "`add @role` — Tambah role exempt\n"
                "`remove @role` — Hapus role exempt\n"
                "`list` — Lihat semua role exempt"
            ),
            inline=False,
        )
        embed.add_field(
            name="💡 Tips",
            value=(
                "• Admin selalu exempt\n"
                "• Config channel override server-wide\n"
                "• Bot butuh permission **Manage Messages**"
            ),
            inline=False,
        )
        embed.set_footer(text="Semua command butuh permission Administrator")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    # ── /automod log ──────────────────────────────────────────────────────────
    @automod.command(name="log", description="Riwayat penghapusan otomatis")
    @app_commands.describe(limit="Jumlah entri (1–20, default 5)")
    async def show_log(
        self,
        interaction: discord.Interaction,
        limit: app_commands.Range[int, 1, 20] = 5,
    ):
        await interaction.response.defer(ephemeral=True)
        rows = await self.db.get_log(interaction.guild.id, limit)

        if not rows:
            await interaction.followup.send(
                embed=info("Delete Log", "Belum ada entri."), ephemeral=True
            )
            return

        embed = discord.Embed(title="📋 Recent Deletions", color=0xF39C12)
        for row in rows:
            user    = interaction.guild.get_member(row["user_id"])
            channel = interaction.guild.get_channel(row["channel_id"])
            embed.add_field(
                name=f"🕐 {row['deleted_at']} UTC",
                value=(
                    f"**User:** {str(user) if user else f'ID:{row[\"user_id\"]}'}\n"
                    f"**Channel:** #{channel.name if channel else row['channel_id']}\n"
                    f"**Reason:** {row['reason']}"
                ),
                inline=False,
            )
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ────────────────────────────────────────────────────────────────────────
    # SERVER GROUP
    # ────────────────────────────────────────────────────────────────────────
    server_group = app_commands.Group(
        name="server", description="Konfigurasi AutoMod server-wide", parent=automod
    )

    @server_group.command(name="links", description="Toggle filter link server-wide")
    @app_commands.describe(enabled="Aktifkan atau matikan")
    async def server_links(self, interaction: discord.Interaction, enabled: bool):
        await self.db.upsert_guild(interaction.guild.id, delete_links=int(enabled))
        await interaction.response.send_message(
            embed=ok("Server Link Filter", f"Filter link **{'aktif' if enabled else 'nonaktif'}** server-wide"),
            ephemeral=True,
        )

    @server_group.command(name="images", description="Toggle filter gambar server-wide")
    @app_commands.describe(enabled="Aktifkan atau matikan")
    async def server_images(self, interaction: discord.Interaction, enabled: bool):
        await self.db.upsert_guild(interaction.guild.id, delete_images=int(enabled))
        await interaction.response.send_message(
            embed=ok("Server Image Filter", f"Filter gambar **{'aktif' if enabled else 'nonaktif'}** server-wide"),
            ephemeral=True,
        )

    @server_group.command(name="logchannel", description="Set channel untuk mod-log")
    @app_commands.describe(channel="Channel tujuan log")
    async def set_log_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        await self.db.upsert_guild(interaction.guild.id, log_channel=channel.id)
        await interaction.response.send_message(
            embed=ok("Log Channel Set", f"Mod log akan dikirim ke {channel.mention}"),
            ephemeral=True,
        )

    @server_group.command(name="warn", description="Toggle DM peringatan ke user saat pesan dihapus")
    @app_commands.describe(enabled="Aktifkan atau matikan")
    async def warn_users(self, interaction: discord.Interaction, enabled: bool):
        await self.db.upsert_guild(interaction.guild.id, warn_user=int(enabled))
        await interaction.response.send_message(
            embed=ok("User Warning", f"DM peringatan **{'aktif' if enabled else 'nonaktif'}**"),
            ephemeral=True,
        )

    # ────────────────────────────────────────────────────────────────────────
    # CHANNEL GROUP
    # ────────────────────────────────────────────────────────────────────────
    channel_group = app_commands.Group(
        name="channel", description="Konfigurasi AutoMod per channel", parent=automod
    )

    @channel_group.command(name="links", description="Toggle filter link di channel tertentu")
    @app_commands.describe(channel="Target channel", enabled="Aktifkan atau matikan")
    async def channel_links(self, interaction: discord.Interaction, channel: discord.TextChannel, enabled: bool):
        await self.db.upsert_channel(channel.id, interaction.guild.id, delete_links=int(enabled))
        await interaction.response.send_message(
            embed=ok("Channel Link Filter", f"Filter link **{'aktif' if enabled else 'nonaktif'}** di {channel.mention}"),
            ephemeral=True,
        )

    @channel_group.command(name="images", description="Toggle filter gambar di channel tertentu")
    @app_commands.describe(channel="Target channel", enabled="Aktifkan atau matikan")
    async def channel_images(self, interaction: discord.Interaction, channel: discord.TextChannel, enabled: bool):
        await self.db.upsert_channel(channel.id, interaction.guild.id, delete_images=int(enabled))
        await interaction.response.send_message(
            embed=ok("Channel Image Filter", f"Filter gambar **{'aktif' if enabled else 'nonaktif'}** di {channel.mention}"),
            ephemeral=True,
        )

    @channel_group.command(name="whitelist_add", description="Izinkan domain tertentu di channel (link tidak dihapus)")
    @app_commands.describe(channel="Target channel", domain="Domain, contoh: youtube.com")
    async def whitelist_add(self, interaction: discord.Interaction, channel: discord.TextChannel, domain: str):
        domain = domain.lower().strip().removeprefix("https://").removeprefix("http://").split("/")[0]
        await self.db.add_whitelist(channel.id, interaction.guild.id, domain)
        await interaction.response.send_message(
            embed=ok("Whitelist Updated", f"`{domain}` ditambahkan ke whitelist {channel.mention}"),
            ephemeral=True,
        )

    @channel_group.command(name="whitelist_remove", description="Hapus domain dari whitelist channel")
    @app_commands.describe(channel="Target channel", domain="Domain yang ingin dihapus")
    async def whitelist_remove(self, interaction: discord.Interaction, channel: discord.TextChannel, domain: str):
        await self.db.remove_whitelist(channel.id, interaction.guild.id, domain.lower().strip())
        await interaction.response.send_message(
            embed=ok("Whitelist Updated", f"`{domain}` dihapus dari whitelist {channel.mention}"),
            ephemeral=True,
        )

    # ────────────────────────────────────────────────────────────────────────
    # ROLE GROUP
    # ────────────────────────────────────────────────────────────────────────
    role_group = app_commands.Group(
        name="role", description="Kelola role yang bypass semua filter", parent=automod
    )

    @role_group.command(name="add", description="Tambah role ke daftar exempt")
    @app_commands.describe(role="Role yang akan dibebaskan dari filter")
    async def role_add(self, interaction: discord.Interaction, role: discord.Role):
        await self.db.add_role(interaction.guild.id, role.id)
        await interaction.response.send_message(
            embed=ok("Exempt Role Added", f"{role.mention} kini bebas dari semua filter"),
            ephemeral=True,
        )

    @role_group.command(name="remove", description="Hapus role dari daftar exempt")
    @app_commands.describe(role="Role yang ingin dihapus dari exempt")
    async def role_remove(self, interaction: discord.Interaction, role: discord.Role):
        await self.db.remove_role(interaction.guild.id, role.id)
        await interaction.response.send_message(
            embed=ok("Exempt Role Removed", f"{role.mention} dihapus dari daftar exempt"),
            ephemeral=True,
        )

    @role_group.command(name="list", description="Lihat semua role yang exempt")
    async def role_list(self, interaction: discord.Interaction):
        roles = await self.db.get_roles(interaction.guild.id)
        mentions = [
            interaction.guild.get_role(rid).mention
            for rid in roles if interaction.guild.get_role(rid)
        ]
        await interaction.response.send_message(
            embed=info("Exempt Roles", ", ".join(mentions) if mentions else "Tidak ada role exempt."),
            ephemeral=True,
        )

    # ── Error Handler ─────────────────────────────────────────────────────────
    async def cog_app_command_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError):
        if isinstance(error, app_commands.MissingPermissions):
            await interaction.response.send_message(
                embed=err("Permission Denied", "Kamu butuh permission **Administrator**."),
                ephemeral=True,
            )
        else:
            log.error(f"Command error: {error}", exc_info=error)
            if not interaction.response.is_done():
                await interaction.response.send_message(
                    embed=err("Error", f"`{error}`"), ephemeral=True
                )


async def setup(bot):
    await bot.add_cog(Commands(bot))

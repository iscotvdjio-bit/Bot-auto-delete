import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  MessageFlags,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { handleMessage } from "./handler.js";
import { commandsByName } from "./commands/index.js";
import { registerCommands } from "./registerCommands.js";

let client: Client | null = null;

export async function startBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error("DISCORD_BOT_TOKEN dan DISCORD_CLIENT_ID wajib diisi di .env");
  }

  await registerCommands(token, clientId);

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info({ user: c.user.tag, guilds: c.guilds.cache.size }, "Discord bot ready");
  });

  client.on(Events.MessageCreate, (message) => {
    handleMessage(message).catch((err) => {
      logger.error({ err }, "Unhandled error in message handler");
    });
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = commandsByName.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      logger.error({ err, commandName: interaction.commandName }, "Slash command failed");
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: "Terjadi kesalahan saat menjalankan perintah ini.",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "Terjadi kesalahan saat menjalankan perintah ini.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch {}
    }
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "Discord client error");
  });

  await client.login(token);
}

export async function stopBot(): Promise<void> {
  if (client) {
    await client.destroy();
    client = null;
  }
}

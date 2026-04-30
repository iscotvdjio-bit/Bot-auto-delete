import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { logger } from "../lib/logger.js";

export async function registerCommands(
  token: string,
  clientId: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    const body = commands.map((c) => c.data);
    await rest.put(Routes.applicationCommands(clientId), { body });
    logger.info({ count: body.length }, "Slash commands registered globally");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
    throw err;
  }
}

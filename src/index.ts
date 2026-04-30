import "dotenv/config";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot/index.js";

startBot().catch((err) => {
  logger.error({ err }, "Failed to start Discord bot");
  process.exit(1);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  process.exit(0);
});

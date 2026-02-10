import "dotenv/config";
import type { AppConfig } from "./types.js";

export function loadConfig(): AppConfig {
  const required = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "CLAUDE_API_KEY",
    "NWS_LATITUDE",
    "NWS_LONGITUDE",
  ] as const;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `See .env.example for required configuration.`
    );
  }

  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    telegramChatId: process.env.TELEGRAM_CHAT_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!,
    nwsLatitude: process.env.NWS_LATITUDE!,
    nwsLongitude: process.env.NWS_LONGITUDE!,
  };
}

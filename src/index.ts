import { loadConfig } from "./config.js";
import {
  fetchCalendarEvents,
  fetchWeather,
  fetchAINews,
  fetchTalkingPieces,
  fetchTodayInHistory,
} from "./sections/index.js";
import { formatDigest, sendTelegramMessage } from "./telegram.js";

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting daily digest...`);

  const config = loadConfig();

  const sections = await Promise.allSettled([
    fetchCalendarEvents(config),
    fetchWeather(config),
    fetchAINews(config),
    fetchTalkingPieces(config),
    fetchTodayInHistory(config),
  ]);

  const digest = formatDigest(sections);
  await sendTelegramMessage(config, digest);

  console.log(`[${new Date().toISOString()}] Daily digest complete.`);
}

main().catch((error: unknown) => {
  console.error("Fatal error in daily digest:", error);
  process.exit(1);
});

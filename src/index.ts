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
  const startTime = Date.now();
  const dryRun = process.argv.includes("--dry-run");

  console.log(`[${new Date().toISOString()}] Starting daily digest...`);

  const config = loadConfig({ dryRun });

  const sections = await Promise.allSettled([
    fetchCalendarEvents(config),
    fetchWeather(config),
    fetchAINews(config),
    fetchTalkingPieces(config),
    fetchTodayInHistory(config),
  ]);

  const digest = formatDigest(sections);

  if (dryRun) {
    console.log(digest);
  } else {
    await sendTelegramMessage(config, digest);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[${new Date().toISOString()}] Daily digest complete in ${elapsed}s.`);
}

main().catch((error: unknown) => {
  console.error("Fatal error in daily digest:", error);
  process.exit(1);
});

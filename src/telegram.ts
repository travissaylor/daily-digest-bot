import type { AppConfig, SectionResult } from "./types.js";

export function formatDigest(
  sections: PromiseSettledResult<SectionResult>[]
): string {
  const parts: string[] = [];

  for (const result of sections) {
    if (result.status === "fulfilled") {
      parts.push(result.value.content);
    } else {
      parts.push("[Section failed]");
    }
  }

  return parts.join("\n\n");
}

// TODO (US-007): Implement with grammy Api, HTML formatting, and 4096 char limit handling
export async function sendTelegramMessage(
  _config: AppConfig,
  message: string
): Promise<void> {
  console.log("=== DAILY DIGEST ===");
  console.log(message);
  console.log("=== END DIGEST ===");
}

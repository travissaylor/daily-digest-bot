import type { AppConfig, SectionResult } from "../types.js";
import openAiClient from "../openai.js";

const Z_AI_MODEL = "glm-4.7";

async function fetchHistoryFromAPI(): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const prompt = `Tell me 1 interesting historical fact about ${today}. Include the year, a brief description of what happened, and why it's notable. Keep it concise — 2-3 sentences total. Do not include any headers or prefixes like "On this day" — just state the fact directly.`;

  const completion = await openAiClient.chat.completions.create({
    model: Z_AI_MODEL,
    messages: [
      { role: "system", content: "You are a knowledgeable historian who shares engaging, accurate historical facts." },
      { role: "user", content: prompt },
    ],
    stream: false,
  });

  const content = completion.choices[0]?.message.content?.trim();
  if (!content) return "📜 Today in History\n\nNo historical fact available today.";

  return `📜 Today in History\n\n${content}`;
}

export async function fetchTodayInHistory(
  _config: AppConfig,
): Promise<SectionResult> {
  try {
    const content = await fetchHistoryFromAPI();
    return {
      name: "Today in History",
      content,
      success: true,
    };
  } catch (err) {
    console.error("Today in History: fetch failed:", err);
    return {
      name: "Today in History",
      content: "📜 Today in History\n\n⚠️ Today in History unavailable today",
      success: false,
    };
  }
}

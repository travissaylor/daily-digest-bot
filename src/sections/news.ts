import type { AppConfig, SectionResult, ZAiWebSearchResponse } from "../types.js";

const Z_AI_ENDPOINT = "https://api.z.ai/api/coding/paas/v4/chat/completions";
const Z_AI_MODEL = "glm-4.7";

interface ParsedNewsItem {
  headline: string;
  summary: string;
  ref: string;
}

// ── Helper: Parse LLM response to extract news items and references ──────

function parseNewsContent(content: string): ParsedNewsItem[] {
  const items: ParsedNewsItem[] = [];
  const lines = content.split("\n");

  let currentHeadline = "";
  let currentSummary = "";
  let currentRef = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Match bold headline: **Headline**
    const headlineMatch = trimmed.match(/^\*\*(.+?)\*\*(.*)$/);
    if (headlineMatch) {
      // Save previous item if exists
      if (currentHeadline) {
        items.push({
          headline: currentHeadline,
          summary: currentSummary.trim(),
          ref: currentRef,
        });
      }

      currentHeadline = headlineMatch[1].trim();
      currentSummary = "";
      currentRef = "";

      // Check if there's a [Source](ref_X) on the same line
      const refMatch = trimmed.match(/\[Source?\]\(ref_(\d+)\)/i);
      if (refMatch) {
        currentRef = refMatch[1];
      }

      continue;
    }

    // Match [Source](ref_X) pattern
    const refMatch = trimmed.match(/\[Source?\]\(ref_(\d+)\)/i);
    if (refMatch && currentHeadline) {
      currentRef = refMatch[1];
      continue;
    }

    // Add to summary if we have a headline
    if (currentHeadline && trimmed) {
      currentSummary += (currentSummary ? " " : "") + trimmed;
    }
  }

  // Don't forget the last item
  if (currentHeadline) {
    items.push({
      headline: currentHeadline,
      summary: currentSummary.trim(),
      ref: currentRef,
    });
  }

  return items;
}

// ── Helper: Format the news section ───────────────────────────────────────

function formatNewsSection(
  items: Array<{ headline: string; summary: string; link: string }>
): string {
  if (items.length === 0) {
    return "🤖 AI News\n\nNo AI news found today.";
  }

  const lines: string[] = ["🤖 AI News", ""];

  for (const item of items) {
    lines.push(`**${item.headline}**`);
    lines.push(item.summary);
    lines.push(`[Source](${item.link})`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ── Helper: Map references to actual search result links ────────────────────

function mapRefsToLinks(
  items: ParsedNewsItem[],
  webSearch: ZAiWebSearchResponse["web_search"]
): Array<{ headline: string; summary: string; link: string }> {
  if (!webSearch) return [];

  const refMap = new Map<string, string>();
  for (const result of webSearch) {
    refMap.set(result.refer, result.link);
  }

  return items
    .map((item) => {
      const link = item.ref ? refMap.get(item.ref) : undefined;
      if (!link) return null;

      return {
        headline: item.headline,
        summary: item.summary,
        link,
      };
    })
    .filter((item): item is { headline: string; summary: string; link: string } => item !== null);
}

// ── Main: Fetch AI news using z.ai web search ──────────────────────────────

async function fetchAINewsFromAPI(apiKey: string): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `Find 3 current AI news items from today or the last 24-48 hours. Prioritize AI tooling news (frameworks, libraries, developer tools, platforms). Ensure diversity in topics and sources.

For each news item:
1. Start with a bold headline using Markdown: **Headline Here**
2. Write 2-3 sentences explaining what happened and why it matters
3. End with [Source](ref_X) where X is the reference number

Today's date is ${today}.

Format example:
**OpenAI Releases New SDK Version**
The new SDK includes improved error handling and better performance for streaming responses. Developers can now use async patterns more easily. [Source](ref_1)`;

  const res = await fetch(Z_AI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Z_AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("z.ai API error:", res.status, body);
    throw new Error(`z.ai API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ZAiWebSearchResponse;

  // Parse the LLM content to extract news items
  const parsedItems = parseNewsContent(data.choices[0].message.content);

  // Map references to actual links from web_search results
  const newsItems = mapRefsToLinks(parsedItems, data.web_search);

  return formatNewsSection(newsItems);
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function fetchAINews(config: AppConfig): Promise<SectionResult> {
  try {
    const content = await fetchAINewsFromAPI(config.zAiApiKey);
    return {
      name: "AI News",
      content,
      success: true,
    };
  } catch (err) {
    console.error("AI News: fetch failed:", err);
    return {
      name: "AI News",
      content: "🤖 AI News\n\n⚠️ AI news unavailable today",
      success: true,
    };
  }
}

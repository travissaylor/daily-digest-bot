import { Api } from "grammy";
import type { AppConfig, SectionResult } from "./types.js";

const TELEGRAM_MAX_LENGTH = 4096;

const SECTION_NAMES = [
  "Calendar",
  "Weather",
  "AI News",
  "Talking Pieces",
  "Today in History",
];

// ── Markdown → Telegram HTML conversion ─────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(md: string): string {
  let html = escapeHtml(md);
  // Convert **bold** → <b>bold</b>
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  // Convert [text](url) → <a href="url">text</a>
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );
  return html;
}

// ── Format digest from section results ──────────────────────────────────────

export function formatDigest(
  sections: PromiseSettledResult<SectionResult>[],
): string {
  const parts: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const result = sections[i];
    if (result.status === "fulfilled") {
      parts.push(result.value.content);
    } else {
      const name = SECTION_NAMES[i] ?? "Section";
      parts.push(`⚠️ ${name} unavailable today`);
    }
  }

  return parts.join("\n\n");
}

// ── Split message into chunks at section boundaries ─────────────────────────

function splitMessage(message: string): string[] {
  if (message.length <= TELEGRAM_MAX_LENGTH) {
    return [message];
  }

  const sections = message.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    const candidate = current ? current + "\n\n" + section : section;

    if (candidate.length <= TELEGRAM_MAX_LENGTH) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = section;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}

// ── Send formatted digest via Telegram ──────────────────────────────────────

export async function sendTelegramMessage(
  config: AppConfig,
  message: string,
): Promise<void> {
  const html = markdownToHtml(message);
  const chunks = splitMessage(html);

  const api = new Api(config.telegramBotToken);

  for (const chunk of chunks) {
    await api.sendMessage(config.telegramChatId, chunk, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  }
}

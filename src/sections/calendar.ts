import { execSync } from "node:child_process";
import type { AppConfig, CalendarEvent, SectionResult } from "../types.js";
import openAiClient from "../openai.js";

const Z_AI_MODEL = "glm-4.7";

function parseEvents(json: string): CalendarEvent[] {
  const raw: unknown = JSON.parse(json);
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.events)
      ? ((raw as Record<string, unknown>).events as unknown[])
      : [];

  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const startObj = item.start as Record<string, string> | undefined;
    const endObj = item.end as Record<string, string> | undefined;

    const startLocal = startObj?.dateTime ?? startObj?.date ?? "";
    const endLocal = endObj?.dateTime ?? endObj?.date ?? "";
    // All-day events have date-only strings (no "T" separator)
    const isAllDay = startLocal.length > 0 && !startLocal.includes("T");

    return {
      id: String(item.id ?? ""),
      summary: String(item.summary ?? "(No title)"),
      startLocal,
      endLocal,
      isAllDay,
      calendarId: item.calendarId ? String(item.calendarId) : undefined,
    };
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEvents(events: CalendarEvent[]): string {
  const allDay = events.filter((e) => e.isAllDay);
  const timed = events
    .filter((e) => !e.isAllDay)
    .sort((a, b) => a.startLocal.localeCompare(b.startLocal));

  const lines: string[] = ["📅 Calendar"];

  if (allDay.length === 0 && timed.length === 0) {
    lines.push("No events scheduled today");
    return lines.join("\n");
  }

  for (const event of allDay) {
    const source = event.calendarId ? ` (${event.calendarId})` : "";
    lines.push(`• [All Day] ${event.summary}${source}`);
  }

  for (const event of timed) {
    const start = formatTime(event.startLocal);
    const end = formatTime(event.endLocal);
    const source = event.calendarId ? ` (${event.calendarId})` : "";
    lines.push(`• ${start} – ${end} | ${event.summary}${source}`);
  }

  return lines.join("\n");
}

async function getCalendarSummary(events: CalendarEvent[]): Promise<string> {
  const timed = events
    .filter((e) => !e.isAllDay)
    .sort((a, b) => a.startLocal.localeCompare(b.startLocal));

  if (timed.length === 0) return "";

  const schedule = timed
    .map((e) => `${formatTime(e.startLocal)} – ${formatTime(e.endLocal)}: ${e.summary}`)
    .join("\n");

  const prompt = `Given this schedule for today, provide a 1-3 sentence overview of the day. Call out any overlapping events, short gaps between meetings (under 30 minutes), back-to-back meetings, and long blocks of free time. Be concise and practical.

Schedule:
${schedule}

Respond with just the summary, no preamble.`;

  const completion = await openAiClient.chat.completions.create({
    model: Z_AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  return completion.choices[0].message.content?.trim() ?? "";
}

export async function fetchCalendarEvents(
  _config: AppConfig,
): Promise<SectionResult> {
  const output = execSync("gog calendar events --today --all --json", {
    encoding: "utf-8",
    timeout: 30_000,
  });

  const events = parseEvents(output);
  let content = formatEvents(events);

  try {
    const summary = await getCalendarSummary(events);
    if (summary) {
      content += `\n\n📋 ${summary}`;
    }
  } catch (err) {
    console.error("Calendar: summary generation failed:", err);
  }

  return {
    name: "Calendar",
    content,
    success: true,
  };
}

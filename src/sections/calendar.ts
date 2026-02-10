import { execSync } from "node:child_process";
import type { AppConfig, CalendarEvent, SectionResult } from "../types.js";

function parseEvents(json: string): CalendarEvent[] {
  const raw: unknown = JSON.parse(json);
  const items = Array.isArray(raw) ? raw : [];

  return items.map((item: Record<string, unknown>) => {
    const startLocal = String(item.startLocal ?? "");
    const endLocal = String(item.endLocal ?? "");
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

export async function fetchCalendarEvents(
  _config: AppConfig,
): Promise<SectionResult> {
  const output = execSync("gog calendar events --today --all --json", {
    encoding: "utf-8",
    timeout: 30_000,
  });

  const events = parseEvents(output);
  const content = formatEvents(events);

  return {
    name: "Calendar",
    content,
    success: true,
  };
}

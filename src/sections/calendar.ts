import type { AppConfig, SectionResult } from "../types.js";

export async function fetchCalendarEvents(
  _config: AppConfig
): Promise<SectionResult> {
  // TODO (US-002): Shell out to `gog calendar events --start today --end tomorrow --json`
  return {
    name: "Calendar",
    content: "[Calendar section - not yet implemented]",
    success: true,
  };
}

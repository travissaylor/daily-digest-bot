import type { AppConfig, SectionResult } from "../types.js";

export async function fetchTodayInHistory(
  _config: AppConfig
): Promise<SectionResult> {
  // TODO (US-006): Claude API for historical fact
  return {
    name: "Today in History",
    content: "[Today in History section - not yet implemented]",
    success: true,
  };
}

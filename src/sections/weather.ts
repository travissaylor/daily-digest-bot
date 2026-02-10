import type { AppConfig, SectionResult } from "../types.js";

export async function fetchWeather(
  _config: AppConfig
): Promise<SectionResult> {
  // TODO (US-003): Two-step NWS API fetch, then Claude for clothing guidance
  return {
    name: "Weather",
    content: "[Weather section - not yet implemented]",
    success: true,
  };
}

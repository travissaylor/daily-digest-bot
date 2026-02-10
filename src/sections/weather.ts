import { execSync } from "node:child_process";
import type { AppConfig, SectionResult, WeatherData } from "../types.js";

const NWS_BASE = "https://api.weather.gov";
const NWS_USER_AGENT = "daily-digest-bot (personal use)";
const Z_AI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";
const Z_AI_MODEL = "glm-4.7-flash";

// ── NWS helpers ─────────────────────────────────────────────────────────────

interface NwsHourlyPeriod {
  startTime: string;
  temperature: number;
  isDaytime: boolean;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  relativeHumidity?: { value: number | null };
}

async function nwsFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": NWS_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`NWS API error ${res.status} for ${url}`);
  }
  return res.json();
}

function todayDateString(): string {
  // Returns YYYY-MM-DD in local time
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function fetchNwsWeather(lat: string, lon: string): Promise<WeatherData> {
  // Step 1: resolve grid point
  const pointsData = (await nwsFetch(`${NWS_BASE}/points/${lat},${lon}`)) as {
    properties: { forecastHourly: string };
  };
  const hourlyUrl = pointsData.properties.forecastHourly;

  // Step 2: fetch hourly forecast
  const hourlyData = (await nwsFetch(hourlyUrl)) as {
    properties: { periods: NwsHourlyPeriod[] };
  };

  const today = todayDateString();
  const periods = hourlyData.properties.periods.filter((p) =>
    p.startTime.startsWith(today)
  );

  if (periods.length === 0) {
    throw new Error("No hourly forecast periods found for today");
  }

  const highTempF = Math.max(...periods.map((p) => p.temperature));
  const lowTempF = Math.min(...periods.map((p) => p.temperature));

  const precipValues = periods.map(
    (p) => p.probabilityOfPrecipitation?.value ?? 0
  );
  const precipChancePct = Math.max(...precipValues);

  const humidityValues = periods
    .map((p) => p.relativeHumidity?.value ?? null)
    .filter((v): v is number => v !== null);
  const humidityPct =
    humidityValues.length > 0
      ? Math.round(humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length)
      : 0;

  // Use the midday daytime period for wind and short forecast
  const daytimePeriods = periods.filter((p) => p.isDaytime);
  const midday =
    daytimePeriods.find((p) => {
      const hour = new Date(p.startTime).getHours();
      return hour >= 11 && hour <= 14;
    }) ??
    daytimePeriods[0] ??
    periods[0];

  const windSpeed = `${midday.windSpeed} ${midday.windDirection}`.trim();

  const precipKeywords = ["Rain", "Snow", "Showers", "Drizzle", "Sleet", "Flurries"];
  const precipType =
    precipKeywords.find((kw) =>
      periods.some((p) => p.shortForecast.includes(kw))
    ) ?? "";

  return {
    highTempF,
    lowTempF,
    precipChancePct,
    precipType,
    humidityPct,
    windSpeed,
    shortForecast: midday.shortForecast,
  };
}

// ── Calendar context ─────────────────────────────────────────────────────────

function getCalendarContext(): string {
  try {
    const out = execSync("gog calendar events --today --all --json", {
      encoding: "utf-8",
      timeout: 15_000,
    });
    const events = JSON.parse(out) as Array<Record<string, unknown>>;
    if (!Array.isArray(events) || events.length === 0) return "";
    return events
      .map((e) => {
        const start = String(e.startLocal ?? "");
        if (!start.includes("T")) return `All day: ${String(e.summary ?? "")}`;
        const time = new Date(start).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return `${time}: ${String(e.summary ?? "")}`;
      })
      .join("; ");
  } catch {
    return "";
  }
}

// ── z.ai clothing guidance ───────────────────────────────────────────────────

interface ZAiResponse {
  choices: Array<{ message: { content: string } }>;
}

async function getClothingGuidance(
  weather: WeatherData,
  calendarContext: string,
  apiKey: string
): Promise<string> {
  const precipLine =
    weather.precipChancePct > 0 && weather.precipType
      ? `${weather.precipChancePct}% chance of ${weather.precipType.toLowerCase()}`
      : weather.precipChancePct > 0
        ? `${weather.precipChancePct}% chance of precipitation`
        : "No precipitation expected";

  const weatherSummary = [
    `High: ${weather.highTempF}°F, Low: ${weather.lowTempF}°F`,
    precipLine,
    `Humidity: ${weather.humidityPct}%`,
    `Wind: ${weather.windSpeed}`,
    `Conditions: ${weather.shortForecast}`,
  ].join(". ");

  const calendarLine = calendarContext
    ? `\n\nToday's schedule: ${calendarContext}`
    : "";

  const prompt = `Given this weather forecast for today, provide 1–2 sentences of practical clothing and preparation advice. Be specific and actionable.

Weather: ${weatherSummary}${calendarLine}

Respond with just the advice, no preamble.`;

  const res = await fetch(Z_AI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Z_AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`z.ai API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ZAiResponse;
  return data.choices[0].message.content.trim();
}

// ── Formatting ───────────────────────────────────────────────────────────────

function formatWeatherSection(weather: WeatherData, guidance: string): string {
  const lines: string[] = ["🌤 Weather"];

  lines.push(`High: ${weather.highTempF}°F  |  Low: ${weather.lowTempF}°F`);

  if (weather.precipChancePct > 0) {
    const desc = weather.precipType
      ? `${weather.precipChancePct}% chance of ${weather.precipType.toLowerCase()}`
      : `${weather.precipChancePct}% chance of precipitation`;
    lines.push(`Precip: ${desc}`);
  } else {
    lines.push("Precip: None expected");
  }

  lines.push(
    `Humidity: ${weather.humidityPct}%  |  Wind: ${weather.windSpeed}`
  );

  lines.push("");
  lines.push(`👕 Today: ${guidance}`);

  return lines.join("\n");
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function fetchWeather(config: AppConfig): Promise<SectionResult> {
  const weather = await fetchNwsWeather(config.nwsLatitude, config.nwsLongitude);

  const calendarContext = getCalendarContext();

  let guidance: string;
  try {
    guidance = await getClothingGuidance(weather, calendarContext, config.zAiApiKey);
  } catch (err) {
    console.error("Weather: clothing guidance failed:", err);
    guidance = "⚠️ Clothing guidance unavailable";
  }

  return {
    name: "Weather",
    content: formatWeatherSection(weather, guidance),
    success: true,
  };
}

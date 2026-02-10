export interface SectionResult {
  name: string;
  content: string;
  success: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  startLocal: string;
  endLocal: string;
  isAllDay: boolean;
  calendarId?: string;
}

export interface WeatherData {
  highTempF: number;
  lowTempF: number;
  precipChancePct: number;
  precipType: string;
  humidityPct: number;
  windSpeed: string;
  shortForecast: string;
}

export interface AppConfig {
  telegramBotToken: string;
  telegramChatId: string;
  zAiApiKey: string;
  nwsLatitude: string;
  nwsLongitude: string;
}

// z.ai web search response types
export interface ZAiWebSearchResult {
  title: string;
  link: string;
  media: string;
  content: string;
  refer: string;
  publish_date?: string;
}

export interface ZAiWebSearchResponse {
  choices: Array<{ message: { content: string } }>;
  web_search?: ZAiWebSearchResult[];
}

export interface SectionResult {
  name: string;
  content: string;
  success: boolean;
}

export interface AppConfig {
  telegramBotToken: string;
  telegramChatId: string;
  claudeApiKey: string;
  nwsLatitude: string;
  nwsLongitude: string;
}

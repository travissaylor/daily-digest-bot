import OpenAI from "openai";
import { loadConfig } from "./config.js";

const config = loadConfig();

const client = new OpenAI({
    apiKey: config.zAiApiKey,
    baseURL: "https://api.z.ai/api/coding/paas/v4"
});

export default client;
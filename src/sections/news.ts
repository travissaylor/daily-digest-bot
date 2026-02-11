import OpenAI from "openai"
import type {
    AppConfig,
    SectionResult,
    ZAiWebSearchResult,
} from "../types.js"

// z.ai extends the standard ChatCompletion response with web search results
interface ZAiChatCompletion extends OpenAI.Chat.Completions.ChatCompletion {
    web_search?: ZAiWebSearchResult[]
}

const Z_AI_MODEL = "glm-4.7"

// Paid API base URL that supports web search
const Z_AI_PAID_BASE_URL = "https://api.z.ai/api/paas/v4"

interface ParsedNewsItem {
    headline: string
    summary: string
    ref: string
}

// ── Helper: Parse LLM response to extract news items and references ──────

function parseNewsContent(content: string): ParsedNewsItem[] {
    const items: ParsedNewsItem[] = []
    const lines = content.split("\n")

    let currentHeadline = ""
    let currentSummary = ""
    let currentRef = ""

    for (const line of lines) {
        const trimmed = line.trim()

        // Match bold headline: **Headline**
        const headlineMatch = trimmed.match(/^\*\*(.+?)\*\*(.*)$/)
        if (headlineMatch) {
            // Save previous item if exists
            if (currentHeadline) {
                items.push({
                    headline: currentHeadline,
                    summary: currentSummary.trim(),
                    ref: currentRef,
                })
            }

            currentHeadline = headlineMatch[1].trim()
            currentSummary = ""
            currentRef = ""

            // Check if there's a [Source: ref_X] on the same line
            const refMatch = trimmed.match(/\[Source:\s*(ref_\d+)\]/i)
            if (refMatch) {
                currentRef = refMatch[1]
            }

            continue
        }

        // Match [Source: ref_X] pattern — may appear mid-line alongside summary text
        const refMatch = trimmed.match(/\[Source:\s*(ref_\d+)\]/i)
        if (refMatch && currentHeadline) {
            currentRef = refMatch[1]
            const summaryPart = trimmed.replace(/\s*\[Source:\s*ref_\d+\]/i, "").trim()
            if (summaryPart) {
                currentSummary += (currentSummary ? " " : "") + summaryPart
            }
            continue
        }

        // Add to summary if we have a headline
        if (currentHeadline && trimmed) {
            currentSummary += (currentSummary ? " " : "") + trimmed
        }
    }

    // Don't forget the last item
    if (currentHeadline) {
        items.push({
            headline: currentHeadline,
            summary: currentSummary.trim(),
            ref: currentRef,
        })
    }

    return items
}

// ── Helper: Format the news section ───────────────────────────────────────

function formatNewsSection(
    items: Array<{ headline: string; summary: string; link?: string }>,
): string {
    if (items.length === 0) {
        return "🤖 AI News\n\nNo AI news found today."
    }

    const lines: string[] = ["🤖 AI News", ""]

    for (const item of items) {
        lines.push(`**${item.headline}**`)
        lines.push(item.summary)
        if (item.link) lines.push(`[Source](${item.link})`)
        lines.push("")
    }

    return lines.join("\n").trimEnd()
}

// ── Helper: Map references to actual search result links ────────────────────

function mapRefsToLinks(
    items: ParsedNewsItem[],
    webSearch: ZAiWebSearchResult[] | undefined,
): Array<{ headline: string; summary: string; link: string }> {
    if (!webSearch) return []

    const refMap = new Map<string, string>()
    for (const result of webSearch) {
        refMap.set(result.refer, result.link)
    }

    return items
        .map((item) => {
            const link = item.ref ? refMap.get(item.ref) : undefined
            if (!link) return null

            return {
                headline: item.headline,
                summary: item.summary,
                link,
            }
        })
        .filter(
            (
                item,
            ): item is { headline: string; summary: string; link: string } =>
                item !== null,
        )
}

// ── Main: Fetch AI news using z.ai web search ──────────────────────────────

async function fetchAINewsFromAPI(config: AppConfig): Promise<string> {
    const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })

    const prompt = `Find 3 current AI news items from today or the last 24-48 hours. Prioritize AI tooling news (frameworks, libraries, developer tools, platforms). Ensure diversity in topics and sources.

For each news item:
1. Start with a bold headline using Markdown: **Headline Here**
2. Write 2-3 sentences explaining what happened and why it matters
3. End with [Source: ref_X] where X is the reference number

Today's date is ${today}.

Format example:
**OpenAI Releases New SDK Version**
The new SDK includes improved error handling and better performance for streaming responses. Developers can now use async patterns more easily. [Source: ref_1]`

    // Use paid API client if web search API key is available, otherwise use free tier
    const useWebSearch = !!config.zAiWebSearchApiKey
    const client = useWebSearch
        ? new OpenAI({
              apiKey: config.zAiWebSearchApiKey,
              baseURL: Z_AI_PAID_BASE_URL,
          })
        : new OpenAI({
              apiKey: config.zAiApiKey,
              baseURL: "https://api.z.ai/api/coding/paas/v4",
          })

    const completions = (await client.chat.completions.create({
        model: Z_AI_MODEL,
        messages: [{role: "system", content: "You are a helpful assistant."}, { role: "user", content: prompt }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search", web_search: { enable: true, search_result: true } }] as any,
        stream: false,
    })) as unknown as ZAiChatCompletion

    const content = completions.choices[0]?.message.content
    if (!content) return formatNewsSection([])

    // Parse the LLM content to extract news items
    const parsedItems = parseNewsContent(content)

    // Map references to actual links from web_search results (if available)
    const newsItems = completions.web_search
        ? mapRefsToLinks(parsedItems, completions.web_search)
        : parsedItems.map(({ headline, summary }) => ({ headline, summary }))

    return formatNewsSection(newsItems)
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function fetchAINews(config: AppConfig): Promise<SectionResult> {
    try {
        const content = await fetchAINewsFromAPI(config)
        return {
            name: "AI News",
            content,
            success: true,
        }
    } catch (err) {
        console.error("AI News: fetch failed:", err)
        return {
            name: "AI News",
            content: "🤖 AI News\n\n⚠️ AI news unavailable today",
            success: false,
        }
    }
}

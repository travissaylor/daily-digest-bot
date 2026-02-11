import type OpenAI from "openai"
import type { AppConfig, SectionResult, ZAiWebSearchResult } from "../types.js"
import openAiClient from "../openai.js"

// z.ai extends the standard ChatCompletion response with web search results
interface ZAiChatCompletion extends OpenAI.Chat.Completions.ChatCompletion {
    web_search?: ZAiWebSearchResult[]
}

const Z_AI_MODEL = "glm-4.7"

interface ParsedPiece {
    title: string
    teaser: string
    ref: string
}

// ── Helper: Parse LLM response to extract talking pieces and references ───

function parsePiecesContent(content: string): ParsedPiece[] {
    const pieces: ParsedPiece[] = []
    const lines = content.split("\n")

    let currentTitle = ""
    let currentTeaser = ""
    let currentRef = ""

    for (const line of lines) {
        const trimmed = line.trim()

        // Match bold title: **Title**
        const titleMatch = trimmed.match(/^\*\*(.+?)\*\*(.*)$/)
        if (titleMatch) {
            // Save previous piece if exists
            if (currentTitle) {
                pieces.push({
                    title: currentTitle,
                    teaser: currentTeaser.trim(),
                    ref: currentRef,
                })
            }

            currentTitle = titleMatch[1].trim()
            currentTeaser = ""
            currentRef = ""

            // Check if there's a [Source](ref_X) on the same line
            const refMatch = trimmed.match(/\[Source\]\(ref_(\d+)\)/i)
            if (refMatch) {
                currentRef = refMatch[1]
            }

            continue
        }

        // Match [Source](ref_X) pattern — may appear mid-line alongside teaser text
        const refMatch = trimmed.match(/\[Source\]\(ref_(\d+)\)/i)
        if (refMatch && currentTitle) {
            currentRef = refMatch[1]
            const teaserPart = trimmed.replace(/\s*\[Source\]\(ref_\d+\)/i, "").trim()
            if (teaserPart) {
                currentTeaser += (currentTeaser ? " " : "") + teaserPart
            }
            continue
        }

        // Add to teaser if we have a title
        if (currentTitle && trimmed) {
            currentTeaser += (currentTeaser ? " " : "") + trimmed
        }
    }

    // Don't forget the last piece
    if (currentTitle) {
        pieces.push({
            title: currentTitle,
            teaser: currentTeaser.trim(),
            ref: currentRef,
        })
    }

    return pieces
}

// ── Helper: Format the talking pieces section ─────────────────────────────

function formatTalkingPiecesSection(
    items: Array<{ title: string; teaser: string; link?: string }>,
): string {
    if (items.length === 0) {
        return "💡 Talking Pieces\n\nNo talking pieces found today."
    }

    const lines: string[] = ["💡 Talking Pieces", ""]

    for (const item of items) {
        lines.push(`**${item.title}**`)
        lines.push(item.teaser)
        if (item.link) lines.push(`[Source](${item.link})`)
        lines.push("")
    }

    return lines.join("\n").trimEnd()
}

// ── Helper: Map references to actual search result links ──────────────────

function mapRefsToLinks(
    pieces: ParsedPiece[],
    webSearch: ZAiWebSearchResult[] | undefined,
): Array<{ title: string; teaser: string; link: string }> {
    if (!webSearch) return []

    const refMap = new Map<string, string>()
    for (const result of webSearch) {
        refMap.set(result.refer, result.link)
    }

    return pieces
        .map((piece) => {
            const link = piece.ref ? refMap.get(piece.ref) : undefined
            if (!link) return null

            return {
                title: piece.title,
                teaser: piece.teaser,
                link,
            }
        })
        .filter(
            (
                item,
            ): item is { title: string; teaser: string; link: string } =>
                item !== null,
        )
}

// ── Main: Fetch talking pieces using z.ai web search ─────────────────────

async function fetchTalkingPiecesFromAPI(): Promise<string> {
    const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })

    const prompt = `Find 3 thought-provoking talking pieces from philosophy, psychology, creativity, or culture. Choose topics that are interesting to discuss and explain accessibly in a Vox explainer style. Ensure diversity — each piece should come from a different domain.

For each piece:
1. Start with a bold title using Markdown: **Title Here**
2. Write 2-3 sentences as a teaser that explains the concept or poses a compelling question
3. End with [Source](ref_X) where X is the reference number, linking to a relevant article or resource

Today's date is ${today}.

Format example:
**Why Boredom Is a Superpower**
Researchers are finding that boredom is not wasted time — it's when the mind wanders into its most creative states. A new wave of psychology suggests we should actively seek it out rather than fill every idle moment with our phones. [Source](ref_1)`

    const completions = (await openAiClient.chat.completions.create({
        model: Z_AI_MODEL,
        messages: [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: prompt }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search", web_search: { enable: true, search_result: true } }] as any,
        stream: false,
    })) as unknown as ZAiChatCompletion

    const content = completions.choices[0]?.message.content
    if (!content) return formatTalkingPiecesSection([])

    // Parse the LLM content to extract talking pieces
    const parsedPieces = parsePiecesContent(content)

    // Map references to actual links from web_search results (if available)
    const pieces = completions.web_search
        ? mapRefsToLinks(parsedPieces, completions.web_search)
        : parsedPieces.map(({ title, teaser }) => ({ title, teaser }))

    return formatTalkingPiecesSection(pieces)
}

// ── Main export ───────────────────────────────────────────────────────────

export async function fetchTalkingPieces(_config: AppConfig): Promise<SectionResult> {
    try {
        const content = await fetchTalkingPiecesFromAPI()
        return {
            name: "Talking Pieces",
            content,
            success: true,
        }
    } catch (err) {
        console.error("Talking Pieces: fetch failed:", err)
        return {
            name: "Talking Pieces",
            content: "💡 Talking Pieces\n\n⚠️ Talking pieces unavailable today",
            success: false,
        }
    }
}

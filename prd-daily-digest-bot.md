# PRD: Daily Digest Bot

## Introduction

A daily digest bot that compiles a personalized morning briefing and delivers it via Telegram at 8:30 AM. The digest includes calendar events from personal and work calendars, detailed weather with clothing guidance, curated AI news, thought-provoking creative talking pieces, and a historical fact. The bot runs as a cron job on a Raspberry Pi 3 (1GB RAM), written in TypeScript.

## Goals

- Deliver a single, well-formatted Telegram message every morning at 8:30 AM
- Aggregate calendar events from personal and work calendars via the `gogcli` CLI tool (which wraps the Google Calendar API with built-in OAuth)
- Provide actionable weather information including clothing recommendations based on the day's schedule
- Surface 3 relevant AI/AI-tooling news items with context and links
- Present 3 creative talking pieces on philosophy, psychology, creativity, or culture
- Include 1 historical fact about the current date
- Run reliably on a Raspberry Pi 3 with graceful error handling and minimal resource usage

## User Stories

### US-001: Project Setup and Configuration
**Description:** As a developer, I want the project scaffolded with TypeScript, environment variables, and a cron-based entry point so that I have a working foundation to build on.

**Acceptance Criteria:**
- [ ] TypeScript project initialized with `tsconfig.json` targeting a Node.js LTS version compatible with Raspberry Pi 3 (ARM)
- [ ] `package.json` with necessary dependencies (node-telegram-bot-api or equivalent, node-fetch or built-in fetch — `googleapis` is NOT needed since calendar access uses `gogcli`)
- [ ] `.env.example` file documenting all required env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CLAUDE_API_KEY`, `NWS_LATITUDE`, `NWS_LONGITUDE` (no Google credentials needed — `gogcli` manages OAuth and token storage via the OS keyring)
- [ ] Entry point script (`src/index.ts`) with a `main()` function that runs the full digest pipeline and exits
- [ ] `.gitignore` includes `.env`, `node_modules`, `dist`
- [ ] Typecheck and lint pass

### US-002: Calendar Events Section
**Description:** As a user, I want to see my personal and work calendar events for the day so that I know my schedule at a glance.

**Acceptance Criteria:**
- [ ] Fetches today's events by shelling out to the `gog` CLI (`gogcli`) with `--json` output (see Technical Considerations)
- [ ] Displays events sorted by start time
- [ ] Each event shows: time (start–end), title, and calendar source (personal/work) if distinguishable
- [ ] All-day events displayed separately at the top
- [ ] If no events, displays "No events scheduled today"
- [ ] Typecheck passes

### US-003: Weather Section
**Description:** As a user, I want detailed weather information with clothing guidance so that I can dress appropriately and plan my day.

**Acceptance Criteria:**
- [ ] Fetches weather from the National Weather Service API using configured lat/long coordinates
- [ ] Displays: high temperature, low temperature, precipitation type and amount (if any), humidity, wind speed
- [ ] Generates clothing/preparation guidance using Claude API based on weather data AND the day's calendar events (e.g., "You have an outdoor meeting at 2 PM — bring a jacket, rain expected around 1 PM")
- [ ] Handles NWS API's two-step flow: first fetch grid point from `/points/{lat},{lon}`, then fetch forecast from the returned forecast URL
- [ ] Typecheck passes

### US-004: AI News Section
**Description:** As a user, I want 3 AI news items so that I stay informed about developments in AI tooling and the broader AI landscape.

**Acceptance Criteria:**
- [ ] Uses Claude API (via z.ai) with web search/tool use to find 3 current AI news items, prioritizing AI tooling
- [ ] Each item includes: a bold headline, 2–3 sentence summary covering what happened and why it matters, and a source link
- [ ] News items are from the current day or very recent (within last 24–48 hours)
- [ ] Items are diverse (not all from the same source or about the same topic)
- [ ] Typecheck passes

### US-005: Creative Talking Pieces Section
**Description:** As a user, I want 3 thought-provoking talking pieces on philosophy, creativity, psychology, or culture so that I have interesting things to think about and discuss.

**Acceptance Criteria:**
- [ ] Uses Claude API to generate or find 3 interesting topics in the style of Vox explainers
- [ ] Each piece includes: a compelling title, 2–3 sentence teaser that explains the concept or poses a question, and a link to a relevant article/resource when available
- [ ] Topics span different domains (e.g., not all philosophy)
- [ ] Content is accessible and engaging, not academic
- [ ] Typecheck passes

### US-006: Today in History Section
**Description:** As a user, I want 1 random historical fact about today's date so that I learn something interesting each morning.

**Acceptance Criteria:**
- [ ] Uses Claude API to generate an interesting historical fact for today's date
- [ ] Includes the year, a brief description of the event, and why it's notable
- [ ] Fact is accurate and engaging
- [ ] Typecheck passes

### US-007: Telegram Message Formatting and Delivery
**Description:** As a user, I want the digest delivered as a single well-formatted Telegram message so that I can read everything in one scroll.

**Acceptance Criteria:**
- [ ] Sends a single Telegram message using the Bot API
- [ ] Message uses Telegram's MarkdownV2 or HTML formatting for headers, bold text, and links
- [ ] Sections are clearly separated with headers/emojis: Calendar, Weather, AI News, Talking Pieces, Today in History
- [ ] Message respects Telegram's 4096 character limit — if exceeded, splits into sequential messages at section boundaries
- [ ] Bot token and chat ID are read from environment variables
- [ ] Typecheck passes

### US-008: Error Handling and Retries
**Description:** As a developer, I want resilient error handling so that partial failures don't prevent the rest of the digest from being delivered.

**Acceptance Criteria:**
- [ ] Each section (calendar, weather, news, talking pieces, history) is fetched independently
- [ ] If a section fails, it retries up to 2 additional times with a short delay
- [ ] If a section still fails after retries, the digest is sent without that section, with a note like "⚠️ Weather unavailable today"
- [ ] Errors are logged to stdout/stderr for debugging (captured by cron or systemd journal)
- [ ] The overall script completes within a reasonable time (under 2 minutes)
- [ ] Typecheck passes

### US-009: Raspberry Pi Cron Deployment
**Description:** As a developer, I want the bot deployed on a Raspberry Pi 3 with a system cron job so that it runs automatically every morning without manual intervention.

**Acceptance Criteria:**
- [ ] TypeScript compiles to JavaScript in a `dist/` directory for execution
- [ ] Entry point (`dist/index.js`) runs the full digest pipeline, logs output, and exits cleanly
- [ ] Cron job configured via `crontab` to run at 8:30 AM daily in the user's timezone
- [ ] Script can also be triggered manually from the command line for testing (e.g., `node dist/index.js`)
- [ ] Runs successfully on Raspberry Pi 3 (ARMv7, 1GB RAM) with Node.js LTS
- [ ] Typecheck passes

## Functional Requirements

- FR-1: The system must fetch today's calendar events from both personal and work calendars by shelling out to `gogcli` and parsing JSON output
- FR-2: The system must fetch weather data from the National Weather Service API using latitude/longitude coordinates
- FR-3: The system must generate clothing/activity guidance by sending weather data and calendar events to the Claude API
- FR-4: The system must use the Claude API (z.ai) with search capabilities to find 3 recent AI news items with summaries and links
- FR-5: The system must use the Claude API to generate 3 creative talking pieces in a Vox-explainer style with links when available
- FR-6: The system must use the Claude API to generate 1 historical fact for today's date
- FR-7: The system must format all sections into a single Telegram message using Telegram-supported formatting
- FR-8: The system must send the formatted message to the configured Telegram chat via the Bot API
- FR-9: The system must retry failed sections up to 2 times before skipping them
- FR-10: The system must include a note in the message for any section that was skipped due to failure
- FR-11: The system must run as a Node.js script triggered daily at 8:30 AM via system cron on a Raspberry Pi 3
- FR-12: The script must exit cleanly after completion (exit code 0 on success, non-zero on fatal failure)

## Non-Goals

- No interactive Telegram commands (this is a one-way push notification, not a chatbot)
- No user-facing configuration or settings UI
- No multi-user support — this is a single-user personal bot
- No historical digest storage or "catch up on missed digests"
- No real-time or push-based updates throughout the day
- No custom news topic selection beyond the hardcoded categories
- No image or media attachments in the Telegram message

## Technical Considerations

- **Raspberry Pi 3 Constraints:** The Pi 3 has a 1.2GHz quad-core ARM Cortex-A53 with 1GB RAM. Node.js runs well on ARM but use an LTS version (Node 20 or 22) installed via `nvm` or the NodeSource APT repository. The script's memory footprint should stay well under 100MB.
- **No Execution Timeout:** Unlike serverless platforms, the Pi has no execution time limit. The script can take as long as needed to complete all API calls, which eliminates the need for aggressive parallelization or request batching. However, parallel API calls are still recommended for faster execution.
- **Calendar Access:** Use the `gogcli` CLI tool (`gog`) to fetch calendar events. `gogcli` has built-in OAuth2 with secure credential storage via the OS keyring (Linux Secret Service on the Pi). One-time setup: install `gogcli`, provide a Google Cloud "Desktop app" OAuth client JSON via `gog auth credentials <file>`, and complete the browser-based OAuth flow (supports `--manual` headless mode for the Pi). After initial auth, tokens auto-refresh indefinitely — no credentials in `.env` needed. The bot shells out to `gog calendar events --start today --end tomorrow --json` and parses the JSON output via `child_process.execSync`. This requires a Google Cloud project with the Calendar API enabled, but eliminates all token management code.
- **Claude API (z.ai):** All LLM-powered sections (weather guidance, AI news, talking pieces, history) use the Claude API via z.ai. Parallel requests are recommended to reduce total execution time but are not strictly required given the lack of a timeout constraint.
- **NWS API:** The National Weather Service API is free, requires no API key, but does require a `User-Agent` header. It uses a two-step fetch: first get the grid point, then get the forecast.
- **Telegram Bot Setup:** Create a bot via @BotFather, get the token. Get the chat ID by messaging the bot and checking `/getUpdates`. Store both as env vars.
- **Cron Configuration:** Use the system `crontab` to schedule the script. Example: `30 8 * * * cd /home/pi/daily-digest-bot && /usr/bin/node dist/index.js >> /home/pi/digest.log 2>&1`. The Pi's system timezone must be set correctly for accurate scheduling.
- **Network Reliability:** The Pi depends on a stable home internet connection. If the network is down at 8:30 AM, the digest won't send. Consider adding a simple check-and-retry mechanism or using `anacron` for missed job recovery.
- **SD Card Longevity:** Minimal concern since the script writes almost nothing to disk, but logging should be kept lightweight. Consider using `logrotate` if logging to a file.
- **Environment Variables:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CLAUDE_API_KEY`, `NWS_LATITUDE`, `NWS_LONGITUDE`. Stored in a `.env` file on the Pi. Google Calendar credentials are NOT stored in `.env` — they are managed by `gogcli` in the OS keyring.
- **`gogcli` Dependency:** The `gog` binary must be installed on the Pi (available as a prebuilt ARM binary or compiled from source via Go). It is a system-level dependency, not an npm package. The cron job must run under the same user account that completed the `gog auth` setup so it can access the keyring.

## Success Metrics

- Digest is delivered to Telegram every morning by 8:30 AM with all 5 sections
- Each section contains accurate, current, and useful information
- AI news items link to real, accessible articles
- Weather guidance is contextually relevant to the day's schedule
- End-to-end execution completes within 2 minutes
- Fewer than 1 full-digest failure per month (individual section failures are acceptable if handled gracefully)

## Open Questions

- What timezone is the Raspberry Pi set to? (Needed for accurate cron scheduling)
- What are the latitude/longitude coordinates for the weather location?
- Do you already have a Google Cloud project with a "Desktop app" OAuth client for Calendar API access, or does that need to be set up? (Required for `gogcli` initial auth)
- Is `gogcli` already installed on the Pi, or does it need to be installed?
- Do you already have a Telegram bot created via @BotFather?
- Is Node.js already installed on the Pi, and if so, which version?
- Should the talking pieces be purely LLM-generated, or should they always link to real published articles?

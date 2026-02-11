# Daily Digest Bot

A daily digest bot that compiles a personalized morning briefing and delivers it via Telegram at 8:30 AM. Includes calendar events, weather with clothing guidance, AI news, creative talking pieces, and a historical fact. Designed to run as a cron job on a Raspberry Pi 3.

## Prerequisites

- **Raspberry Pi 3** (or any Linux ARM device) running Raspberry Pi OS / Raspbian
- **Node.js LTS** (v20 or v22) — see [Install Node.js](#1-install-nodejs) below
- **gogcli** (`gog`) — CLI tool for Google Calendar access, installed and authenticated
- **Telegram bot** — created via [@BotFather](https://t.me/BotFather)
- **Google Cloud project** with Calendar API enabled and a "Desktop app" OAuth client

## Setup

### 1. Install Node.js

**Option A: nvm (recommended)**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
node --version  # should print v22.x.x
```

**Option B: NodeSource APT repository**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install gogcli

Install the `gog` binary (prebuilt ARM binary or compile from source via Go). Then complete the one-time OAuth setup:

```bash
# Provide your Google Cloud OAuth client credentials
gog auth credentials /path/to/oauth-client.json

# Complete the OAuth flow (use --manual for headless Pi)
gog auth login --manual
```

The OAuth tokens are stored in the OS keyring. See [Troubleshooting](#troubleshooting) if you have keyring issues with cron.

### 3. Clone and Install

```bash
git clone <your-repo-url> ~/daily-digest-bot
cd ~/daily-digest-bot
npm ci
npm run build
```

### 4. Configure Environment

```bash
cp .env.example .env
vim .env
```

Fill in all values:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your chat ID (message the bot, then check `/getUpdates`) |
| `Z_AI_API_KEY` | API key from z.ai |
| `NWS_LATITUDE` | Weather location latitude (e.g. `40.7128`) |
| `NWS_LONGITUDE` | Weather location longitude (e.g. `-74.0060`) |

### 5. Test Manually

```bash
node dist/index.js
# or: npm start
```

You should receive a Telegram message with all 5 digest sections. Check stdout for timestamped logs.

### 6. Set Timezone

The cron job runs in the system's local timezone. Make sure it's set correctly:

```bash
sudo timedatectl set-timezone America/New_York  # adjust to your timezone
timedatectl  # verify
```

### 7. Configure Cron

```bash
crontab -e
```

Paste the line from `crontab.example` (adjust paths if needed):

```
30 8 * * * cd /home/pi/daily-digest-bot && /usr/bin/node dist/index.js >> /home/pi/digest.log 2>&1
```

If using nvm, replace `/usr/bin/node` with the full path to your nvm-managed node:

```bash
which node  # find the path
```

### 8. Verify Cron

Wait for the next 8:30 AM, or temporarily set cron to run in a few minutes for testing:

```bash
tail -f ~/digest.log
```

## Development

```bash
npm run dev      # run with tsx (no build step)
npm run check    # typecheck + lint
npm run build    # compile to dist/
npm start        # run compiled output
```

## Troubleshooting

**`.env` not found / missing environment variables**
Cron must `cd` into the project directory before running `node`. The `dotenv` library loads `.env` relative to the current working directory.

**`node: command not found` in cron**
Cron uses a minimal PATH. Use the absolute path to node in the crontab entry. Find it with `which node`.

**`gog` fails to access keyring from cron**
`gogcli` stores OAuth tokens in the OS keyring (Linux Secret Service). Cron jobs may not have access to the D-Bus session needed for keyring access. Workarounds:

1. Add `DBUS_SESSION_BUS_ADDRESS` to the crontab:
   ```
   DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
   30 8 * * * cd /home/pi/daily-digest-bot && /usr/bin/node dist/index.js >> /home/pi/digest.log 2>&1
   ```
   (Replace `1000` with your user ID — find it with `id -u`.)

2. Or create a wrapper script that sources the session environment before running the bot.

**Log rotation**
If `digest.log` grows too large, set up logrotate:

```bash
sudo tee /etc/logrotate.d/daily-digest-bot << 'EOF'
/home/pi/digest.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
EOF
```

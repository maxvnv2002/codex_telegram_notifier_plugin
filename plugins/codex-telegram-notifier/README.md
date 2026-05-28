# Codex Telegram Notifier Plugin

Node.js Codex plugin that sends a Telegram message when Codex finishes work. It pairs this local device with the deployed backend at `https://codex.signalhex.ru`, then uses a signed `Stop` hook notification.

## How It Works

1. Open the Telegram bot and run `/start` or `/newcode`.
2. Copy the pairing code from Telegram.
3. Run plugin setup with that code.
4. The plugin generates a local `deviceId` and `deviceSecret`, registers them with the backend, and stores local state outside this repo.
5. When Codex stops, `hooks.json` runs the notifier script and sends a signed notification.

Local state is stored at:

```text
~/.codex-telegram-notifier/config.json
```

Do not commit or share that file. It contains `deviceSecret`.

## Install

Recommended install through Codex:

```bash
codex plugin marketplace add https://github.com/maxvnv2002/codex_telegram_notifier_plugin.git
codex plugin add codex-telegram-notifier@codex-telegram-notifier
```

SSH alternative for private/development access:

```bash
codex plugin marketplace add git@github.com:maxvnv2002/codex_telegram_notifier_plugin.git
codex plugin add codex-telegram-notifier@codex-telegram-notifier
```

Restart Codex Desktop after installation.

The plugin uses only Node.js built-ins. No `npm install` is required.

Requirements:

```bash
node --version
```

Use Node.js `20` or newer.

## Configure Pairing

Get a pairing code from the Telegram bot, then ask Codex:

```text
/notifier_start ABCD-1234-EFGH
```

Codex will run the local setup command from the installed plugin cache.

Manual Terminal fallback:

```bash
SCRIPT="$(find "${CODEX_HOME:-$HOME/.codex}/plugins/cache" \
  -path "*/codex-telegram-notifier/*/scripts/codex-telegram-notifier.mjs" \
  -type f | sort | tail -n 1)"

node "$SCRIPT" setup \
  --pairing-code ABCD-1234-EFGH \
  --device-name "MacBook Maks"
```

You can also pass values through environment variables:

```bash
CODEX_TELEGRAM_PAIRING_CODE=ABCD-1234-EFGH \
CODEX_TELEGRAM_DEVICE_NAME="MacBook Maks" \
node scripts/codex-telegram-notifier.mjs setup
```

## Check Status

```bash
node scripts/codex-telegram-notifier.mjs status
```

This prints safe state only. It does not show `deviceSecret`.

## Test Notification

After setup:

```bash
node scripts/codex-telegram-notifier.mjs test --message "Manual test from Codex"
```

You should receive a Telegram message in the chat that owns the pairing code.

## Codex Stop Hook

The plugin includes:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/codex-telegram-notifier.mjs\" notify",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

The hook command reads Codex hook JSON from stdin. It tries to include:

- project directory name;
- current git branch;
- session id;
- turn id;
- model;
- final assistant message or a fallback completion message.

Notification failures are written to:

```text
~/.codex-telegram-notifier/notifier.log
```

The hook exits successfully on notification failure so it does not block normal Codex completion.

## Code Structure

```text
scripts/codex-telegram-notifier.mjs  CLI entrypoint
scripts/src/cli.mjs                  command router
scripts/src/commands/install.mjs     local Codex marketplace install and setup wizard
scripts/src/commands/setup.mjs       device registration flow
scripts/src/commands/notify.mjs      Stop hook and manual test notification flow
scripts/src/commands/status.mjs      safe local config status
scripts/src/config.mjs               local config path, load/save, URL validation
scripts/src/http.mjs                 JSON fetch wrapper with timeout
scripts/src/signature.mjs            HMAC SHA256 signing
scripts/src/hook-input.mjs           hook JSON parsing and message extraction
scripts/src/project-info.mjs         project name and git branch discovery
scripts/src/notification-payload.mjs backend notification payload builder
scripts/src/logging.mjs              local safe log writer
```

## Manual Hook Simulation

```bash
printf '%s' '{
  "cwd": "'$PWD'",
  "session_id": "manual-session",
  "turn_id": "manual-turn",
  "model": "manual-test",
  "last_assistant_message": "Codex finished a manual hook simulation."
}' | node scripts/codex-telegram-notifier.mjs notify
```

## API Signing

For `/api/codex/notify`, the script sends:

- `x-codex-device-id`;
- `x-codex-timestamp`;
- `x-codex-signature`.

The signature format is:

```text
sha256=<hmac hex>
```

The HMAC payload is:

```text
<timestamp>.<raw JSON body>
```

The secret is the generated local `deviceSecret`.

## Troubleshooting

Check local config state:

```bash
node scripts/codex-telegram-notifier.mjs status
```

Check local notifier logs:

```bash
tail -n 100 ~/.codex-telegram-notifier/notifier.log
```

Common problems:

- `Plugin is not configured`: run `setup` with a fresh pairing code.
- `Pairing code expired`: get a new code from Telegram with `/newcode`.
- `Pairing code already used`: pairing codes are one-time; create a new one.
- `Request timed out`: check backend availability and whether the server can reach Telegram.
- No Telegram message after a successful setup: check backend logs and webhook health.

## Update

Pull the latest plugin code:

```bash
git pull --ff-only
```

Your local registration state remains in `~/.codex-telegram-notifier/config.json`, outside the repository.

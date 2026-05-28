# Codex Telegram Notifier Plugin

Node.js Codex plugin that sends Telegram messages when Codex finishes work or waits for a user answer. It pairs this local device with the deployed backend at `https://codex.signalhex.ru`, then installs a signed Codex `notify` wrapper.

## How It Works

1. Open the Telegram bot and run `/start` or `/newcode`.
2. Copy the pairing code from Telegram.
3. Run plugin setup with that code.
4. The plugin generates a local `deviceId` and `deviceSecret`, registers them with the backend, and stores local state outside this repo.
5. On setup, the plugin updates `~/.codex/config.toml` and preserves the previous `notify` command.
6. When a Codex turn ends, the wrapper runs the previous notifier first, then sends Telegram.

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

If this device is already paired and you only need to repair automatic notifications, run:

```text
/notifier_start
```

Manual Terminal fallback:

```bash
SCRIPT="$(find "${CODEX_HOME:-$HOME/.codex}/plugins/cache" \
  -path "*/codex-telegram-notifier/*/scripts/codex-telegram-notifier.mjs" \
  -type f | sort | tail -n 1)"

node "$SCRIPT" setup \
  --pairing-code ABCD-1234-EFGH \
  --device-name "MacBook Maks"
```

Repair notify wrapper for an already configured device:

```bash
node "$SCRIPT" /notifier_start
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

This prints safe state only. It does not show `deviceSecret`. It also reports whether the Codex notify wrapper is installed.

## Test Notification

After setup:

```bash
node scripts/codex-telegram-notifier.mjs test --message "Manual test from Codex"
```

You should receive a Telegram message in the chat that owns the pairing code.

## Codex Notify Wrapper

Setup writes a top-level `notify` entry to `~/.codex/config.toml`:

```toml
notify = ["node", "<installed-plugin>/scripts/codex-telegram-notifier.mjs", "turn-ended"]
```

If a previous `notify` command exists, it is stored in `~/.codex-telegram-notifier/config.json` under `codexNotify.originalNotify`. The wrapper calls that original command first, then sends Telegram. This keeps the built-in Codex Desktop turn-ended notifier working.

A one-time backup is written next to the Codex config:

```text
~/.codex/config.toml.codex-telegram-notifier.bak
```

Restart Codex Desktop or start a new session after changing the wrapper.

## Legacy Stop Hook

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

The hook command can still be called manually and reads Codex hook JSON from stdin. The primary automatic path is the `notify` wrapper above.

The notifier tries to include:

- project directory name;
- current git branch;
- session id;
- turn id;
- model;
- event type: `completed` or `waiting_for_input`;
- response options when Codex exposes suggested answers/actions;
- final assistant message or a fallback completion message.

## Notification Suppression

Automatic notifications are filtered before sending:

- plan-mode title-only intermediate events such as `{"title":"..."}` are suppressed;
- events with `waitingOnApproval` or `waitingOnUserInput` active flags are sent as `waiting_for_input`;
- if the user is active and Codex is the active/visible app, the notification is suppressed;
- if the user is active in another app, the notification is sent.

By default, "user active" means idle time is below `60000ms`. Manual `test` notifications ignore this suppression and always send.

Idle detection:

- macOS: `IOHIDSystem` via `ioreg`;
- Linux X11: `xprintidle` when installed;
- Linux GNOME/Wayland: GNOME IdleMonitor via `gdbus` when available;
- Windows: `GetLastInputInfo`.

Codex active-window detection:

- macOS app: frontmost app name via `osascript`;
- macOS CLI: frontmost terminal app plus Codex in the current process ancestry;
- Linux: focused window via `xdotool`, `hyprctl`, or `swaymsg`, plus Codex process ancestry for terminal windows.

If idle time or active-window state cannot be detected on the current system, the plugin sends the notification rather than dropping it.

Optional environment overrides:

```bash
CODEX_TELEGRAM_IDLE_THRESHOLD_MS=120000
CODEX_TELEGRAM_SUPPRESS_WHEN_CODEX_ACTIVE=false
CODEX_TELEGRAM_FORCE_CODEX_ACTIVE=false
CODEX_TELEGRAM_SUPPRESS_PLAN_TITLE_ONLY=false
```

`CODEX_TELEGRAM_SUPPRESS_WHEN_USER_ACTIVE=false` is still accepted for older configs, but the preferred setting is `CODEX_TELEGRAM_SUPPRESS_WHEN_CODEX_ACTIVE=false`.

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
scripts/src/commands/turn-ended.mjs  Codex notify wrapper entrypoint
scripts/src/codex-notify-config.mjs  Codex config notify wrapper install/read helpers
scripts/src/config.mjs               local config path, load/save, URL validation
scripts/src/http.mjs                 JSON fetch wrapper with timeout
scripts/src/notification-filter.mjs  plan-mode and user-activity suppression
scripts/src/codex-activity.mjs       active Codex window detection
scripts/src/signature.mjs            HMAC SHA256 signing
scripts/src/hook-input.mjs           hook JSON parsing and message extraction
scripts/src/project-info.mjs         project name and git branch discovery
scripts/src/notification-payload.mjs backend notification payload builder
scripts/src/user-activity.mjs        cross-platform idle detection
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
- `Codex notify wrapper: not installed`: run `/notifier_start` from Codex or `node "$SCRIPT" /notifier_start` from Terminal.
- `Notification suppressed: User active`: this is expected when you are actively using the machine. Increase/decrease `CODEX_TELEGRAM_IDLE_THRESHOLD_MS` if needed.
- `Notification suppressed: Plan title-only intermediate notification`: this is expected in plan mode for non-final title events.
- Built-in Codex Desktop notifications stopped: restore `notify` from `~/.codex-telegram-notifier/config.json` or from `~/.codex/config.toml.codex-telegram-notifier.bak`.

## Update

Pull the latest plugin code:

```bash
git pull --ff-only
```

Your local registration state remains in `~/.codex-telegram-notifier/config.json`, outside the repository.

---
name: codex-telegram-notifier
description: Configure and use the Codex Telegram Notifier plugin to register this device and send Codex completion notifications to Telegram. Trigger when the user writes /notifier_start or asks to set up Telegram notifier.
---

# Codex Telegram Notifier

Use this skill when the user needs to configure, inspect, or test the Codex Telegram Notifier plugin.

## Start Pairing

When the user writes `/notifier_start CODE` or asks to start notifier setup:

- If the device is not configured and the user did not provide a code, ask them to get one from the Telegram bot with `/newcode`.
- If the device is already configured, `/notifier_start` without a code repairs the Codex notify wrapper.
- Locate the installed plugin script under Codex's plugin cache.
- Run setup with the pairing code, or without a code for repair.

Use this command shape:

```bash
SCRIPT="$(find "${CODEX_HOME:-$HOME/.codex}/plugins/cache" \
  -path "*/codex-telegram-notifier/*/scripts/codex-telegram-notifier.mjs" \
  -type f | sort | tail -n 1)"

node "$SCRIPT" /notifier_start CODE
```

For wrapper repair on an already configured device:

```bash
node "$SCRIPT" /notifier_start
```

The setup command registers the device with the backend, stores device state in `~/.codex-telegram-notifier/config.json`, and installs the Codex `notify` wrapper in `~/.codex/config.toml`.

## Setup

Ask the user to get a pairing code from the Telegram bot with `/start` or `/newcode`, then run:

```bash
node scripts/codex-telegram-notifier.mjs setup --pairing-code CODE
```

Optional settings:

```bash
node scripts/codex-telegram-notifier.mjs setup \
  --pairing-code CODE \
  --server-url https://codex.signalhex.ru \
  --device-name "MacBook Maks"
```

## Status

```bash
node scripts/codex-telegram-notifier.mjs status
```

Never print `deviceSecret` or full local config contents. The status command is safe.

## Test Notification

```bash
node scripts/codex-telegram-notifier.mjs test --message "Manual test from Codex"
```

## Hook Notification

Automatic turn-ended notification runs through Codex `notify`:

```toml
notify = ["node", "<installed-plugin>/scripts/codex-telegram-notifier.mjs", "turn-ended"]
```

The wrapper calls the previous Codex `notify` command first, then sends Telegram.

Automatic notifications are suppressed for plan-mode title-only intermediate payloads and while the local user is active. Manual `test` notifications bypass suppression.

The legacy Stop hook command is:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-telegram-notifier.mjs" notify
```

The command reads JSON from stdin, signs the request with the local device secret, and sends it to `/api/codex/notify`.

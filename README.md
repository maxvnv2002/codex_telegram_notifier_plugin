# Codex Telegram Notifier Marketplace

Marketplace repository for the `codex-telegram-notifier` Codex plugin.

The plugin sends Telegram notifications when Codex finishes work. It registers your local device with the backend at `https://codex.signalhex.ru`, stores the generated device secret locally, and installs a Codex `notify` wrapper that preserves the existing Desktop notifier.

## Install Through Codex

Add this GitHub repository as a Codex plugin marketplace:

```bash
codex plugin marketplace add https://github.com/maxvnv2002/codex_telegram_notifier_plugin.git
```

Install the plugin:

```bash
codex plugin add codex-telegram-notifier@codex-telegram-notifier
```

SSH alternative for private/development access:

```bash
codex plugin marketplace add git@github.com:maxvnv2002/codex_telegram_notifier_plugin.git
```

Restart Codex Desktop after installation.

## Pair With Telegram

In Telegram, open the bot and run:

```text
/newcode
```

Then in Codex, send:

```text
/notifier_start ABCD-1234-EFGH
```

Codex will run the plugin setup command locally and register this device.

If the device is already registered, you can run the same command without a code to repair the local Codex notify wrapper:

```text
/notifier_start
```

The wrapper writes a stable launcher to `~/.codex-telegram-notifier/bin/codex-telegram-notifier.mjs` and edits `~/.codex/config.toml` so Codex runs:

```text
node ~/.codex-telegram-notifier/bin/codex-telegram-notifier.mjs turn-ended
```

The stable launcher resolves the newest installed plugin version from Codex's plugin cache. The resolved plugin first calls the previous `notify` command, then sends Telegram.

Automatic notifications are suppressed when Codex emits plan-mode title-only intermediate events, or when the local user is active and Codex is the active/visible app. If the user is active in another app, the notification still sends. Manual test notifications always send.

## Manual Setup Fallback

If you want to run setup from Terminal instead of asking Codex, locate the installed script and run it directly:

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

Test notification:

```bash
node "$SCRIPT" test --message "Manual test from Codex"
```

## Update

Refresh the marketplace snapshot:

```bash
codex plugin marketplace upgrade codex-telegram-notifier
```

Then restart Codex Desktop. After `/notifier_start` has installed the stable launcher once, `~/.codex/config.toml` does not need to be repaired for every plugin version update.

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/codex-telegram-notifier/
  .codex-plugin/plugin.json
  hooks.json
  scripts/
  skills/
  README.md
```

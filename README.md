# Codex Telegram Notifier Marketplace

Marketplace repository for the `codex-telegram-notifier` Codex plugin.

The plugin sends Telegram notifications when Codex finishes work. It registers your local device with the backend at `https://codex.signalhex.ru`, stores the generated device secret locally, and sends signed notifications from a Codex `Stop` hook.

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

Test notification:

```bash
node "$SCRIPT" test --message "Manual test from Codex"
```

## Update

Refresh the marketplace snapshot:

```bash
codex plugin marketplace upgrade codex-telegram-notifier
```

Then restart Codex Desktop.

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

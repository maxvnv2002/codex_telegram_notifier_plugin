import { DEFAULT_SERVER_URL } from "./constants.mjs";

export function printHelp() {
  console.log(`Codex Telegram Notifier plugin

Usage:
  node scripts/codex-telegram-notifier.mjs install [--pairing-code CODE] [--device-name NAME]
  node scripts/codex-telegram-notifier.mjs /notifier_start CODE [--device-name NAME]
  node scripts/codex-telegram-notifier.mjs setup --pairing-code CODE [--server-url URL] [--device-name NAME]
  node scripts/codex-telegram-notifier.mjs status
  node scripts/codex-telegram-notifier.mjs test [--message TEXT]
  node scripts/codex-telegram-notifier.mjs notify
  node scripts/codex-telegram-notifier.mjs turn-ended

Commands:
  install  Connect the plugin to Codex Desktop and run setup.
  /notifier_start
           Register this device and install the Codex notify wrapper.
  setup    Register this local Codex device and install the Codex notify wrapper.
  status   Print safe local registration state without secrets.
  test     Send a manual signed notification using the saved config.
  notify   Read Codex Stop hook JSON from stdin and send a notification.
  turn-ended
           Codex notify wrapper. Runs the original Codex notify command, then Telegram.

Options:
  --pairing-code CODE   Pairing code from the Telegram bot.
  --server-url URL      Backend URL. Default: ${DEFAULT_SERVER_URL}
  --device-name NAME    Human-readable local device name.
  --config PATH         Alternate local config path.
  --codex-config PATH   Alternate Codex config.toml path.
  --message TEXT        Manual test notification text.
  --skip-codex-notify   Do not edit Codex config.toml notify command.
  --idle-threshold-ms N  Suppress automatic notifications while user idle time is below N ms.
  --skip-setup          Install into Codex without registering a device.
  --skip-codex-config   Create local marketplace without editing ~/.codex/config.toml.

Environment:
  CODEX_TELEGRAM_PAIRING_CODE
  CODEX_TELEGRAM_SERVER_URL
  CODEX_TELEGRAM_DEVICE_NAME
  CODEX_TELEGRAM_CONFIG
  CODEX_TELEGRAM_IDLE_THRESHOLD_MS
  CODEX_TELEGRAM_SUPPRESS_WHEN_USER_ACTIVE
  CODEX_TELEGRAM_SUPPRESS_PLAN_TITLE_ONLY`);
}

import os from "node:os";
import path from "node:path";

export const DEFAULT_SERVER_URL = "https://codex.signalhex.ru";
export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".codex-telegram-notifier");
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_DATA_DIR, "config.json");
export const DEFAULT_LOG_PATH = path.join(DEFAULT_DATA_DIR, "notifier.log");
export const HTTP_TIMEOUT_MS = 10000;
export const NOTIFY_FAILURE_EXIT_CODE = 0;

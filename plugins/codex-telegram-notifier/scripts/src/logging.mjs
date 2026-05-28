import { appendFileSync, mkdirSync } from "node:fs";
import { DEFAULT_DATA_DIR, DEFAULT_LOG_PATH } from "./constants.mjs";

export async function logSafe(message) {
  const timestamp = new Date().toISOString();
  mkdirSync(DEFAULT_DATA_DIR, { recursive: true, mode: 0o700 });
  appendFileSync(DEFAULT_LOG_PATH, `${timestamp} ${message}\n`, { mode: 0o600 });
}

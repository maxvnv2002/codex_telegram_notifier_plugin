import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringOption } from "./args.mjs";
import { DEFAULT_CONFIG_PATH } from "./constants.mjs";
import { errorMessage } from "./errors.mjs";

export function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read config ${configPath}: ${errorMessage(error)}`);
  }
}

export function saveConfig(configPath, config) {
  mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function resolveConfigPath(args) {
  const configuredPath = stringOption(args, "config") || process.env.CODEX_TELEGRAM_CONFIG;
  if (!configuredPath) {
    return DEFAULT_CONFIG_PATH;
  }
  return path.resolve(expandHome(configuredPath));
}

export function isConfigured(config) {
  return Boolean(config.serverUrl && config.deviceId && config.deviceName && config.deviceSecret);
}

export function normalizeServerUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("Missing server URL.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid server URL: ${raw}`);
  }

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalhost) {
    throw new Error("Server URL must use https, except for localhost testing.");
  }

  return url.toString().replace(/\/+$/, "");
}

export function defaultDeviceName() {
  const hostname = os.hostname() || "local-device";
  return `Codex on ${hostname}`.slice(0, 100);
}

function expandHome(value) {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

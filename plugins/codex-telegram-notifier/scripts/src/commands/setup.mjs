import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";
import { stringOption } from "../args.mjs";
import {
  defaultDeviceName,
  loadConfig,
  normalizeServerUrl,
  resolveConfigPath,
  saveConfig,
} from "../config.mjs";
import { DEFAULT_SERVER_URL } from "../constants.mjs";
import { requestJson } from "../http.mjs";
import { normalizePairingCode } from "../pairing-code.mjs";

export async function setupCommand(args) {
  const configPath = resolveConfigPath(args);
  const existing = loadConfig(configPath);
  const pairingCode = resolvePairingCode(args, existing);

  if (!pairingCode) {
    throw new Error("Missing pairing code. Run setup --pairing-code CODE.");
  }

  const serverUrl = resolveServerUrl(args, existing);
  const deviceName = resolveDeviceName(args, existing);
  const deviceId = existing.deviceId || randomUUID();
  const deviceSecret = existing.deviceSecret || randomBytes(32).toString("hex");

  const response = await registerDevice(serverUrl, {
    pairingCode,
    deviceId,
    deviceName,
    deviceSecret,
  });

  const nextConfig = buildNextConfig(existing, {
    serverUrl,
    pairingCode,
    deviceId: response.deviceId || deviceId,
    deviceName: response.deviceName || deviceName,
    deviceSecret,
  });

  saveConfig(configPath, nextConfig);
  printSetupResult(configPath, nextConfig);
}

function resolvePairingCode(args, existing) {
  return normalizePairingCode(
    stringOption(args, "pairing-code") ||
      stringOption(args, "pairingCode") ||
      args._[0] ||
      process.env.CODEX_TELEGRAM_PAIRING_CODE ||
      existing.pairingCode,
  );
}

function resolveServerUrl(args, existing) {
  return normalizeServerUrl(
    stringOption(args, "server-url") ||
      stringOption(args, "serverUrl") ||
      process.env.CODEX_TELEGRAM_SERVER_URL ||
      existing.serverUrl ||
      DEFAULT_SERVER_URL,
  );
}

function resolveDeviceName(args, existing) {
  return (
    stringOption(args, "device-name") ||
    stringOption(args, "deviceName") ||
    process.env.CODEX_TELEGRAM_DEVICE_NAME ||
    existing.deviceName ||
    defaultDeviceName()
  );
}

async function registerDevice(serverUrl, payload) {
  return requestJson(`${serverUrl}/api/codex/register-device`, {
    method: "POST",
    body: payload,
  });
}

function buildNextConfig(existing, nextValues) {
  const now = new Date().toISOString();
  return {
    ...nextValues,
    registeredAt: existing.registeredAt || now,
    lastSetupAt: now,
  };
}

function printSetupResult(configPath, config) {
  console.log("Device registered.");
  console.log(`Config: ${configPath}`);
  console.log(`Server: ${config.serverUrl}`);
  console.log(`Device name: ${config.deviceName}`);
  console.log(`Device id: ${config.deviceId}`);
}

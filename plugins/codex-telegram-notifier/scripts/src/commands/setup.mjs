import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";
import { stringOption } from "../args.mjs";
import { installCodexNotifyWrapper } from "../codex-notify-config.mjs";
import {
  defaultDeviceName,
  isConfigured,
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
  const nextConfig = await resolveNextConfig(args, existing);
  saveConfig(configPath, nextConfig);

  const finalConfig = maybeInstallCodexNotifyWrapper(args, nextConfig);
  saveConfig(configPath, finalConfig);

  printSetupResult(configPath, finalConfig);
}

async function resolveNextConfig(args, existing) {
  const explicitPairingCode = resolveExplicitPairingCode(args);
  const storedPairingCode = normalizePairingCode(existing.pairingCode);
  const alreadyConfigured = isConfigured(existing);
  const shouldRegister =
    Boolean(explicitPairingCode) &&
    (!alreadyConfigured || explicitPairingCode !== storedPairingCode || args["force-register"]);

  if (!shouldRegister && alreadyConfigured) {
    return buildNextConfig(existing, {
      serverUrl: resolveServerUrl(args, existing),
      pairingCode: existing.pairingCode,
      deviceId: existing.deviceId,
      deviceName: resolveDeviceName(args, existing),
      deviceSecret: existing.deviceSecret,
    });
  }

  const pairingCode = explicitPairingCode || storedPairingCode;
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

  return buildNextConfig(existing, {
    serverUrl,
    pairingCode,
    deviceId: response.deviceId || deviceId,
    deviceName: response.deviceName || deviceName,
    deviceSecret,
  });
}

function resolveExplicitPairingCode(args) {
  return normalizePairingCode(
    stringOption(args, "pairing-code") ||
      stringOption(args, "pairingCode") ||
      args._[0] ||
      process.env.CODEX_TELEGRAM_PAIRING_CODE,
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
    ...existing,
    ...nextValues,
    registeredAt: existing.registeredAt || now,
    lastSetupAt: now,
  };
}

function maybeInstallCodexNotifyWrapper(args, config) {
  if (args["skip-codex-notify"] || args["skip-notify-wrapper"]) {
    return config;
  }

  return {
    ...config,
    codexNotify: installCodexNotifyWrapper(args, config),
  };
}

function printSetupResult(configPath, config) {
  console.log("Device configured.");
  console.log(`Config: ${configPath}`);
  console.log(`Server: ${config.serverUrl}`);
  console.log(`Device name: ${config.deviceName}`);
  console.log(`Device id: ${config.deviceId}`);
  if (config.codexNotify?.enabled) {
    console.log(`Codex notify wrapper: installed in ${config.codexNotify.codexConfigPath}`);
    console.log(`Original Codex notify preserved: ${config.codexNotify.originalNotify ? "yes" : "no"}`);
  }
}

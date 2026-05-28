import { isConfigured, loadConfig, resolveConfigPath } from "../config.mjs";
import { getCodexNotifyWrapperStatus } from "../codex-notify-config.mjs";

export function statusCommand(args) {
  const configPath = resolveConfigPath(args);
  const config = loadConfig(configPath);
  const notifyStatus = getCodexNotifyWrapperStatus(args, config);

  console.log("Codex Telegram Notifier status");
  console.log(`Config: ${configPath}`);
  console.log(`Codex config: ${notifyStatus.codexConfigPath}`);

  if (!isConfigured(config)) {
    console.log("Configured: no");
    console.log("Run: node scripts/codex-telegram-notifier.mjs setup --pairing-code CODE");
    console.log(`Codex notify wrapper: ${notifyStatus.installed ? "installed" : "not installed"}`);
    return;
  }

  console.log("Configured: yes");
  console.log(`Server: ${config.serverUrl}`);
  console.log(`Device name: ${config.deviceName}`);
  console.log(`Device id: ${config.deviceId}`);
  console.log(`Registered at: ${config.registeredAt || "unknown"}`);
  console.log(`Last setup at: ${config.lastSetupAt || "unknown"}`);
  console.log(`Pairing code stored: ${config.pairingCode ? "yes" : "no"}`);
  console.log("Device secret: hidden");
  console.log(`Codex notify wrapper: ${notifyStatus.installed ? "installed" : "not installed"}`);
  console.log(`Original Codex notify preserved: ${notifyStatus.hasOriginalNotify ? "yes" : "no"}`);
}

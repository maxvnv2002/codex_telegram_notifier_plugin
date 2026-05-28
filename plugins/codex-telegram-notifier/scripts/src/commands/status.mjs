import { isConfigured, loadConfig, resolveConfigPath } from "../config.mjs";
import { getCodexNotifyWrapperStatus } from "../codex-notify-config.mjs";
import { getNotificationPolicy } from "../notification-filter.mjs";

export function statusCommand(args) {
  const configPath = resolveConfigPath(args);
  const config = loadConfig(configPath);
  const notifyStatus = getCodexNotifyWrapperStatus(args, config);
  const policy = getNotificationPolicy(config, args);

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
  console.log(`Suppress plan title-only events: ${policy.suppressPlanTitleOnly ? "yes" : "no"}`);
  console.log(`Suppress when user active: ${policy.suppressWhenUserActive ? "yes" : "no"}`);
  console.log(`Idle threshold: ${policy.idleThresholdMs}ms`);
}

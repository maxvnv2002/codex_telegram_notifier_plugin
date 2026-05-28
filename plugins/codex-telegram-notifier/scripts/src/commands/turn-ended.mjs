import { spawnSync } from "node:child_process";
import process from "node:process";
import { isNotifyWrapperCommand } from "../codex-notify-config.mjs";
import { loadConfig, resolveConfigPath } from "../config.mjs";
import { errorMessage } from "../errors.mjs";
import { logSafe } from "../logging.mjs";
import { readStdin } from "../stdin.mjs";
import { sendNotificationFromRawInput } from "./notify.mjs";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 10000;

export async function turnEndedCommand(args) {
  const rawInput = await readNotifyInput(args);
  const config = await safeLoadConfig(args);

  await runOriginalNotify(config.codexNotify?.originalNotify, rawInput);
  await sendNotificationFromRawInput(args, rawInput, { failOnError: false });
}

async function readNotifyInput(args) {
  const rawInput = await readStdin();
  if (rawInput.trim()) {
    return rawInput;
  }

  const firstArg = Array.isArray(args._) ? args._[0] : "";
  return typeof firstArg === "string" && firstArg.trim().startsWith("{") ? firstArg : "";
}

async function safeLoadConfig(args) {
  try {
    return loadConfig(resolveConfigPath(args));
  } catch (error) {
    await logSafe(`Failed to read notifier config before upstream notify: ${errorMessage(error)}`);
    return {};
  }
}

async function runOriginalNotify(command, rawInput) {
  if (!Array.isArray(command) || command.length === 0) {
    return;
  }

  if (isNotifyWrapperCommand(command)) {
    await logSafe("Skipped recursive original Codex notify command.");
    return;
  }

  const timeout = resolveUpstreamTimeout();
  try {
    const result = spawnSync(command[0], command.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      input: rawInput,
      encoding: "utf8",
      timeout,
      stdio: ["pipe", "ignore", "pipe"],
    });

    if (result.error) {
      await logSafe(`Original Codex notify failed: ${errorMessage(result.error)}`);
      return;
    }

    if (result.status !== 0) {
      await logSafe(`Original Codex notify exited with code ${result.status ?? "unknown"}.`);
    }
  } catch (error) {
    await logSafe(`Original Codex notify failed: ${errorMessage(error)}`);
  }
}

function resolveUpstreamTimeout() {
  const fromEnv = Number(process.env.CODEX_TELEGRAM_UPSTREAM_NOTIFY_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_UPSTREAM_TIMEOUT_MS;
}

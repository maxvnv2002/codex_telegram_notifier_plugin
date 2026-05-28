import { randomBytes } from "node:crypto";
import process from "node:process";
import { stringOption } from "../args.mjs";
import { isConfigured, loadConfig, resolveConfigPath } from "../config.mjs";
import { NOTIFY_FAILURE_EXIT_CODE } from "../constants.mjs";
import { errorMessage } from "../errors.mjs";
import { parseHookInput } from "../hook-input.mjs";
import { requestJson } from "../http.mjs";
import { logSafe } from "../logging.mjs";
import { shouldSuppressNotification } from "../notification-filter.mjs";
import { buildNotificationPayload } from "../notification-payload.mjs";
import { createSignature } from "../signature.mjs";
import { readStdin } from "../stdin.mjs";

export async function testCommand(args) {
  const message = stringOption(args, "message") || "Manual Codex Telegram Notifier test.";
  const hookInput = {
    cwd: process.cwd(),
    session_id: `manual-${Date.now()}`,
    turn_id: randomBytes(6).toString("hex"),
    model: "manual-test",
    message,
  };

  await sendNotificationFromHookInput(args, hookInput, { failOnError: true, respectSuppression: false });
  console.log("Test notification sent.");
}

export async function notifyCommand(args) {
  const hookInput = await readHookInput();
  await sendNotificationFromHookInput(args, hookInput, { failOnError: false });
}

export async function sendNotificationFromRawInput(args, rawInput, options) {
  let hookInput = {};
  try {
    hookInput = parseHookInput(rawInput);
  } catch (error) {
    await logSafe(`Failed to parse notify input: ${errorMessage(error)}`);
  }

  await sendNotificationFromHookInput(args, hookInput, options);
}

async function readHookInput() {
  try {
    const rawInput = await readStdin();
    return parseHookInput(rawInput);
  } catch (error) {
    await logSafe(`Failed to parse hook input: ${errorMessage(error)}`);
    return {};
  }
}

async function sendNotificationFromHookInput(args, hookInput, options) {
  const configPath = resolveConfigPath(args);
  let config;
  try {
    config = loadConfig(configPath);
  } catch (error) {
    await handleNotificationFailure(`Cannot read notifier config ${configPath}: ${errorMessage(error)}`, options);
    return;
  }

  if (!isConfigured(config)) {
    await handleNotificationFailure(
      `Plugin is not configured. Run setup with a Telegram pairing code. Config: ${configPath}`,
      options,
    );
    return;
  }

  const notification = buildNotificationPayload(config, hookInput);
  const suppression = shouldSuppressNotification({ config, args, hookInput, notification, options });
  if (suppression) {
    await logSafe(`Notification suppressed: ${suppression.reason}`);
    return;
  }

  const rawBody = JSON.stringify(notification);
  const timestamp = String(Date.now());
  const signature = createSignature(timestamp, rawBody, config.deviceSecret);

  try {
    const response = await postNotification(config, rawBody, timestamp, signature);
    await logNotificationResult(notification, response);
  } catch (error) {
    await handleNotificationFailure(`Notification failed: ${errorMessage(error)}`, options);
  }
}

async function postNotification(config, rawBody, timestamp, signature) {
  return requestJson(`${config.serverUrl}/api/codex/notify`, {
    method: "POST",
    rawBody,
    headers: {
      "x-codex-device-id": config.deviceId,
      "x-codex-timestamp": timestamp,
      "x-codex-signature": signature,
    },
  });
}

async function logNotificationResult(notification, response) {
  if (response.duplicate) {
    await logSafe("Duplicate notification skipped by backend.");
    return;
  }

  await logSafe(`Notification sent for project ${notification.projectName || "unknown"}.`);
}

async function handleNotificationFailure(message, options) {
  if (options.failOnError) {
    throw new Error(message);
  }

  await logSafe(message);
  process.exitCode = NOTIFY_FAILURE_EXIT_CODE;
}

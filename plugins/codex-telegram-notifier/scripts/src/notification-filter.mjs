import { getCodexActiveState } from "./codex-activity.mjs";
import { isWaitingForHumanInput } from "./hook-input.mjs";
import { getUserIdleMs } from "./user-activity.mjs";

const DEFAULT_IDLE_THRESHOLD_MS = 60_000;

export function getNotificationPolicy(config = {}, args = {}) {
  const stored = config.notificationPolicy || {};

  return {
    suppressPlanTitleOnly: booleanOption(
      args["suppress-plan-title-only"] ?? process.env.CODEX_TELEGRAM_SUPPRESS_PLAN_TITLE_ONLY ?? stored.suppressPlanTitleOnly,
      true,
    ),
    suppressWhenCodexActive: booleanOption(
      args["suppress-when-codex-active"] ??
        process.env.CODEX_TELEGRAM_SUPPRESS_WHEN_CODEX_ACTIVE ??
        args["suppress-when-user-active"] ??
        process.env.CODEX_TELEGRAM_SUPPRESS_WHEN_USER_ACTIVE ??
        stored.suppressWhenCodexActive ??
        stored.suppressWhenUserActive,
      true,
    ),
    idleThresholdMs: positiveNumberOption(
      args["idle-threshold-ms"] ?? process.env.CODEX_TELEGRAM_IDLE_THRESHOLD_MS ?? stored.idleThresholdMs,
      DEFAULT_IDLE_THRESHOLD_MS,
    ),
  };
}

export function shouldSuppressNotification({ config, args, hookInput, notification, options = {} }) {
  if (options.respectSuppression === false) {
    return null;
  }

  const policy = getNotificationPolicy(config, args);

  if (
    policy.suppressPlanTitleOnly &&
    notification.eventType !== "waiting_for_input" &&
    !isWaitingForHumanInput(hookInput) &&
    isPlanTitleOnlyMessage(notification.message)
  ) {
    return { reason: "Plan title-only intermediate notification." };
  }

  if (policy.suppressWhenCodexActive) {
    const idle = getUserIdleMs();
    if (!idle.available || idle.idleMs >= policy.idleThresholdMs) {
      return null;
    }

    const codexActive = getCodexActiveState();
    if (codexActive.available && codexActive.active) {
      return {
        reason:
          `Codex active (${idle.idleMs}ms idle via ${idle.source}, ` +
          `${codexActive.source}${codexActive.detail ? `: ${codexActive.detail}` : ""}).`,
      };
    }
  }

  return null;
}

export function isPlanTitleOnlyMessage(message) {
  if (typeof message !== "string") {
    return false;
  }

  const trimmed = message.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return false;
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  if (!title) {
    return false;
  }

  const meaningfulKeys = Object.keys(parsed).filter((key) => {
    const value = parsed[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });

  const nonPlanKeys = meaningfulKeys.filter((key) => !["title", "type", "status"].includes(key));
  return nonPlanKeys.length === 0;
}

function booleanOption(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function positiveNumberOption(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

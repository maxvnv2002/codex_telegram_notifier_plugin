import { getUserIdleMs } from "./user-activity.mjs";

const DEFAULT_IDLE_THRESHOLD_MS = 60_000;

export function getNotificationPolicy(config = {}, args = {}) {
  const stored = config.notificationPolicy || {};

  return {
    suppressPlanTitleOnly: booleanOption(
      args["suppress-plan-title-only"] ?? process.env.CODEX_TELEGRAM_SUPPRESS_PLAN_TITLE_ONLY ?? stored.suppressPlanTitleOnly,
      true,
    ),
    suppressWhenUserActive: booleanOption(
      args["suppress-when-user-active"] ?? process.env.CODEX_TELEGRAM_SUPPRESS_WHEN_USER_ACTIVE ?? stored.suppressWhenUserActive,
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

  if (policy.suppressPlanTitleOnly && isWaitingForHumanInput(hookInput)) {
    return { reason: "Codex is waiting for approval/user input." };
  }

  if (policy.suppressPlanTitleOnly && isPlanTitleOnlyMessage(notification.message)) {
    return { reason: "Plan title-only intermediate notification." };
  }

  if (policy.suppressWhenUserActive) {
    const idle = getUserIdleMs();
    if (idle.available && idle.idleMs < policy.idleThresholdMs) {
      return {
        reason: `User active (${idle.idleMs}ms idle via ${idle.source}, threshold ${policy.idleThresholdMs}ms).`,
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

function isWaitingForHumanInput(value, depth = 0) {
  if (!value || depth > 4) {
    return false;
  }

  if (typeof value === "string") {
    return value === "waitingOnApproval" || value === "waitingOnUserInput";
  }

  if (Array.isArray(value)) {
    return value.some((item) => isWaitingForHumanInput(item, depth + 1));
  }

  if (typeof value !== "object") {
    return false;
  }

  for (const key of ["activeFlags", "active_flags", "active-flags", "flags", "status"]) {
    if (isWaitingForHumanInput(value[key], depth + 1)) {
      return true;
    }
  }

  return false;
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

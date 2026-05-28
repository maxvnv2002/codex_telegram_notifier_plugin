export function parseHookInput(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed);
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function resolveNotificationMessage(hookInput) {
  const direct = getFirstString(hookInput, [
    ["last_assistant_message"],
    ["last-assistant-message"],
    ["lastAssistantMessage"],
    ["assistant_message"],
    ["assistant-message"],
    ["assistantMessage"],
    ["final_message"],
    ["final-message"],
    ["finalMessage"],
    ["message"],
    ["summary"],
    ["output_text"],
    ["outputText"],
    ["result"],
  ]);

  if (direct) {
    return limitString(direct, 3000);
  }

  const fromMessages = findLastAssistantMessage(hookInput);
  if (fromMessages) {
    return limitString(fromMessages, 3000);
  }

  return "Codex завершил работу.";
}

export function resolveNotificationEventType(hookInput) {
  if (isWaitingForHumanInput(hookInput) || resolveResponseOptions(hookInput).length > 0) {
    return "waiting_for_input";
  }

  return "completed";
}

export function resolveResponseOptions(hookInput) {
  const collected = [];
  collectResponseOptions(hookInput, collected, 0);

  const seen = new Set();
  return collected
    .map((value) => limitString(value.trim().replace(/\s+/g, " "), 200))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export function isWaitingForHumanInput(value, depth = 0) {
  if (!value || depth > 6) {
    return false;
  }

  if (typeof value === "string") {
    return isWaitingStatus(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => isWaitingForHumanInput(item, depth + 1));
  }

  if (typeof value !== "object") {
    return false;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isWaitingStatus(key) || isWaitingForHumanInput(nestedValue, depth + 1)) {
      return true;
    }
  }

  return false;
}

export function getFirstString(source, paths) {
  for (const candidatePath of paths) {
    const value = getByPath(source, candidatePath);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

const RESPONSE_OPTION_KEYS = new Set([
  "options",
  "choices",
  "suggestions",
  "actions",
  "responses",
  "responseoptions",
  "suggestedresponses",
]);

const RESPONSE_OPTION_CONTAINER_KEYS = new Set([
  "prompt",
  "input",
  "approval",
  "question",
  "request",
  "userinput",
]);

const RESPONSE_OPTION_TEXT_KEYS = [
  "text",
  "title",
  "label",
  "name",
  "value",
  "message",
  "command",
  "description",
];

function collectResponseOptions(value, collected, depth) {
  if (!value || depth > 6 || collected.length >= 10) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectResponseOptions(item, collected, depth + 1);
      if (collected.length >= 10) {
        return;
      }
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);
    if (RESPONSE_OPTION_KEYS.has(normalizedKey)) {
      collectOptionList(nestedValue, collected, depth + 1);
      continue;
    }

    if (RESPONSE_OPTION_CONTAINER_KEYS.has(normalizedKey)) {
      collectResponseOptions(nestedValue, collected, depth + 1);
    }
  }
}

function collectOptionList(value, collected, depth) {
  if (!value || depth > 7 || collected.length >= 10) {
    return;
  }

  if (typeof value === "string") {
    collected.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectOptionList(item, collected, depth + 1);
      if (collected.length >= 10) {
        return;
      }
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const text = extractOptionText(value);
  if (text) {
    collected.push(text);
  }
}

function extractOptionText(value) {
  for (const key of RESPONSE_OPTION_TEXT_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function isWaitingStatus(value) {
  const normalized = normalizeKey(value);
  return [
    "waitingonapproval",
    "waitingonuserinput",
    "waitingforinput",
    "waitingforuserinput",
    "waitingforapproval",
    "awaitinginput",
    "awaitinguserinput",
    "awaitingapproval",
    "needsinput",
    "needsuserinput",
    "requiresaction",
    "approvalrequired",
  ].includes(normalized);
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .replaceAll("_", "");
}

function findLastAssistantMessage(value) {
  const arrays = [
    getByPath(value, ["messages"]),
    getByPath(value, ["conversation"]),
    getByPath(value, ["transcript"]),
    getByPath(value, ["events"]),
    getByPath(value, ["input-messages"]),
    getByPath(value, ["inputMessages"]),
  ].filter(Array.isArray);

  for (const items of arrays) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      const role = typeof item?.role === "string" ? item.role.toLowerCase() : "";
      const type = typeof item?.type === "string" ? item.type.toLowerCase() : "";
      if (role === "assistant" || type.includes("assistant")) {
        const text = stringifyContent(item.content || item.text || item.message || item.delta);
        if (text) {
          return text;
        }
      }
    }
  }

  return "";
}

function stringifyContent(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(stringifyContent).filter(Boolean).join("\n").trim();
  }
  if (typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text.trim();
    }
    if (typeof value.content === "string") {
      return value.content.trim();
    }
  }
  return "";
}

function getByPath(source, candidatePath) {
  let current = source;
  for (const part of candidatePath) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function limitString(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 20)}\n...[truncated]`;
}

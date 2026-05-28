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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringOption } from "./args.mjs";

const WRAPPER_COMMAND = "turn-ended";
const BACKUP_SUFFIX = ".codex-telegram-notifier.bak";

export function resolveCodexConfigPath(args = {}) {
  const configured =
    stringOption(args, "codex-config") ||
    stringOption(args, "codexConfig") ||
    process.env.CODEX_CONFIG;

  if (configured) {
    return path.resolve(expandHome(configured));
  }

  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return path.join(codexHome, "config.toml");
}

export function buildNotifyWrapperCommand() {
  return ["node", resolveEntrypointPath(), WRAPPER_COMMAND];
}

export function installCodexNotifyWrapper(args = {}, currentConfig = {}) {
  const codexConfigPath = resolveCodexConfigPath(args);
  mkdirSync(path.dirname(codexConfigPath), { recursive: true });

  const existingText = existsSync(codexConfigPath) ? readFileSync(codexConfigPath, "utf8") : "";
  const existingNotify = findTopLevelNotifyAssignment(existingText);
  const wrapperCommand = buildNotifyWrapperCommand();
  const previousOriginalNotify = normalizeNotifyCommand(currentConfig.codexNotify?.originalNotify);

  let originalNotify = previousOriginalNotify;
  if (existingNotify?.command?.length && !isNotifyWrapperCommand(existingNotify.command)) {
    originalNotify = existingNotify.command;
  }

  const nextText = upsertNotifyAssignment(existingText, existingNotify, wrapperCommand);
  if (nextText !== existingText) {
    writeConfigBackup(codexConfigPath, existingText);
    writeFileSync(codexConfigPath, nextText, { mode: 0o600 });
  }

  return {
    enabled: true,
    codexConfigPath,
    originalNotify,
    wrapperCommand,
    installedAt: new Date().toISOString(),
  };
}

export function getCodexNotifyWrapperStatus(args = {}, localConfig = {}) {
  const codexConfigPath = resolveCodexConfigPath(args);
  const existingText = existsSync(codexConfigPath) ? readFileSync(codexConfigPath, "utf8") : "";
  const existingNotify = findTopLevelNotifyAssignment(existingText);

  return {
    codexConfigPath,
    installed: Boolean(existingNotify?.command && isNotifyWrapperCommand(existingNotify.command)),
    hasOriginalNotify: Boolean(normalizeNotifyCommand(localConfig.codexNotify?.originalNotify)),
  };
}

export function isNotifyWrapperCommand(command) {
  const normalized = normalizeNotifyCommand(command);
  if (!normalized) {
    return false;
  }

  if (isDirectNotifyWrapperCommand(normalized)) {
    return true;
  }

  const previousNotify = extractPreviousNotifyCommand(normalized);
  return Boolean(previousNotify && isDirectNotifyWrapperCommand(previousNotify));
}

function isDirectNotifyWrapperCommand(command) {
  return command.some((part) => part.endsWith("codex-telegram-notifier.mjs")) && command.includes(WRAPPER_COMMAND);
}

function extractPreviousNotifyCommand(command) {
  const markerIndex = command.indexOf("--previous-notify");
  if (markerIndex === -1) {
    return null;
  }

  const raw = command[markerIndex + 1];
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeNotifyCommand(parsed);
  } catch {
    return null;
  }
}

function resolveEntrypointPath() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../codex-telegram-notifier.mjs");
}

function findTopLevelNotifyAssignment(text) {
  const firstTableIndex = findFirstTableIndex(text);
  const pattern = /^notify\s*=/gm;
  let match;

  while ((match = pattern.exec(text))) {
    if (firstTableIndex !== -1 && match.index > firstTableIndex) {
      return null;
    }

    const arrayStart = text.indexOf("[", pattern.lastIndex - 1);
    if (arrayStart === -1) {
      return null;
    }

    const arrayEnd = findMatchingArrayEnd(text, arrayStart);
    if (arrayEnd === -1) {
      return null;
    }

    return {
      start: match.index,
      end: arrayEnd + 1,
      command: parseTomlStringArray(text.slice(arrayStart, arrayEnd + 1)),
    };
  }

  return null;
}

function findFirstTableIndex(text) {
  const match = /^\s*\[[^\]]+\]/m.exec(text);
  return match ? match.index : -1;
}

function findMatchingArrayEnd(text, start) {
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "]") {
      return index;
    }
  }

  return -1;
}

function parseTomlStringArray(value) {
  const result = [];
  let index = 0;

  while (index < value.length) {
    const char = value[index];
    if (char !== '"' && char !== "'") {
      index += 1;
      continue;
    }

    const parsed = parseTomlString(value, index);
    result.push(parsed.value);
    index = parsed.end + 1;
  }

  return result;
}

function parseTomlString(source, start) {
  const quote = source[start];
  let index = start + 1;
  let escaped = false;
  let raw = quote;

  for (; index < source.length; index += 1) {
    const char = source[index];
    raw += char;

    if (quote === "'") {
      if (char === "'") {
        return { value: raw.slice(1, -1), end: index };
      }
      continue;
    }

    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      return { value: JSON.parse(raw), end: index };
    }
  }

  throw new Error("Invalid notify string array in Codex config.");
}

function upsertNotifyAssignment(text, existingNotify, command) {
  const line = `notify = ${serializeTomlStringArray(command)}`;

  if (existingNotify) {
    return `${text.slice(0, existingNotify.start)}${line}${text.slice(existingNotify.end)}`;
  }

  if (!text.trim()) {
    return `${line}\n`;
  }

  return `${line}\n\n${text.replace(/^\s+/, "")}`;
}

function serializeTomlStringArray(values) {
  return `[${values.map((value) => JSON.stringify(String(value))).join(", ")}]`;
}

function writeConfigBackup(configPath, existingText) {
  if (!existingText) {
    return;
  }

  const backupPath = `${configPath}${BACKUP_SUFFIX}`;
  if (!existsSync(backupPath)) {
    writeFileSync(backupPath, existingText, { mode: 0o600 });
  }
}

function normalizeNotifyCommand(command) {
  return Array.isArray(command) && command.every((part) => typeof part === "string") ? command : null;
}

function expandHome(value) {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

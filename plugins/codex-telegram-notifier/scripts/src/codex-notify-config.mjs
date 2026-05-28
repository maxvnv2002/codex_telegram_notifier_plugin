import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringOption } from "./args.mjs";
import { DEFAULT_DATA_DIR } from "./constants.mjs";

const WRAPPER_COMMAND = "turn-ended";
const BACKUP_SUFFIX = ".codex-telegram-notifier.bak";
const STABLE_WRAPPER_NAME = "codex-telegram-notifier.mjs";
const PLUGIN_NAME = "codex-telegram-notifier";

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

export function resolveStableWrapperPath(args = {}) {
  const configured =
    stringOption(args, "stable-wrapper") ||
    stringOption(args, "stableWrapper") ||
    process.env.CODEX_TELEGRAM_STABLE_WRAPPER;

  if (configured) {
    return path.resolve(expandHome(configured));
  }

  return path.join(DEFAULT_DATA_DIR, "bin", STABLE_WRAPPER_NAME);
}

export function buildNotifyWrapperCommand(args = {}) {
  return ["node", resolveStableWrapperPath(args), WRAPPER_COMMAND];
}

export function installCodexNotifyWrapper(args = {}, currentConfig = {}) {
  const codexConfigPath = resolveCodexConfigPath(args);
  mkdirSync(path.dirname(codexConfigPath), { recursive: true });
  const stableWrapperPath = installStableWrapper(args);

  const existingText = existsSync(codexConfigPath) ? readFileSync(codexConfigPath, "utf8") : "";
  const existingNotify = findTopLevelNotifyAssignment(existingText);
  const wrapperCommand = buildNotifyWrapperCommand(args);
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
    wrapperMode: "stable-shim",
    stableWrapperPath,
    fallbackEntrypoint: resolveEntrypointPath(),
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
    wrapperMode: describeWrapperMode(existingNotify?.command, args),
    stableWrapperPath: resolveStableWrapperPath(args),
    stableWrapperExists: existsSync(resolveStableWrapperPath(args)),
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

function describeWrapperMode(command, args) {
  const normalized = normalizeNotifyCommand(command);
  if (!normalized) {
    return "missing";
  }

  if (containsStableWrapperCommand(normalized, args)) {
    return "stable-shim";
  }

  if (isNotifyWrapperCommand(normalized)) {
    return "versioned-cache";
  }

  return "other";
}

function containsStableWrapperCommand(command, args) {
  const normalized = normalizeNotifyCommand(command);
  if (!normalized) {
    return false;
  }

  const stableWrapperPath = resolveStableWrapperPath(args);
  if (normalized.includes(stableWrapperPath) && normalized.includes(WRAPPER_COMMAND)) {
    return true;
  }

  const previousNotify = extractPreviousNotifyCommand(normalized);
  return Boolean(previousNotify && containsStableWrapperCommand(previousNotify, args));
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

function installStableWrapper(args) {
  const stableWrapperPath = resolveStableWrapperPath(args);
  const wrapperText = buildStableWrapperText(resolveEntrypointPath());
  mkdirSync(path.dirname(stableWrapperPath), { recursive: true, mode: 0o700 });
  writeFileSync(stableWrapperPath, wrapperText, { mode: 0o700 });
  return stableWrapperPath;
}

function buildStableWrapperText(fallbackEntrypoint) {
  return `#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PLUGIN_NAME = ${JSON.stringify(PLUGIN_NAME)};
const FALLBACK_ENTRYPOINT = ${JSON.stringify(fallbackEntrypoint)};

const entrypoint = resolveLatestEntrypoint() || (existsSync(FALLBACK_ENTRYPOINT) ? FALLBACK_ENTRYPOINT : "");
if (!entrypoint) {
  console.error("codex-telegram-notifier: cannot find installed plugin entrypoint.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [entrypoint, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(\`codex-telegram-notifier: failed to run \${entrypoint}: \${result.error.message}\`);
  process.exit(1);
}

process.exit(result.status ?? 0);

function resolveLatestEntrypoint() {
  const cacheRoot = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "plugins", "cache");
  const candidates = findEntrypoints(cacheRoot)
    .map((entrypointPath) => buildCandidate(entrypointPath))
    .filter(Boolean)
    .sort(compareCandidates);

  return candidates.at(-1)?.entrypointPath || null;
}

function findEntrypoints(root) {
  if (!existsSync(root)) {
    return [];
  }

  const result = [];
  walk(root, 0, result);
  return result;
}

function walk(directory, depth, result) {
  if (depth > 8) {
    return;
  }

  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, depth + 1, result);
      continue;
    }

    if (
      entry.isFile() &&
      entry.name === "codex-telegram-notifier.mjs" &&
      fullPath.includes(\`\${path.sep}\${PLUGIN_NAME}\${path.sep}\`) &&
      fullPath.endsWith(path.join("scripts", "codex-telegram-notifier.mjs"))
    ) {
      result.push(fullPath);
    }
  }
}

function buildCandidate(entrypointPath) {
  const pluginRoot = path.dirname(path.dirname(entrypointPath));
  const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.name !== PLUGIN_NAME) {
      return null;
    }

    return {
      entrypointPath,
      version: parseVersion(manifest.version),
      mtimeMs: statSync(entrypointPath).mtimeMs,
    };
  } catch {
    return null;
  }
}

function compareCandidates(left, right) {
  const versionDiff = compareVersions(left.version, right.version);
  if (versionDiff !== 0) {
    return versionDiff;
  }

  return left.mtimeMs - right.mtimeMs;
}

function parseVersion(version) {
  return String(version || "")
    .split(/[.-]/)
    .map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isFinite(value) ? value : 0;
    });
}

function compareVersions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}
`;
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

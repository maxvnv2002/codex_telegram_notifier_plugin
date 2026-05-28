import { spawnSync } from "node:child_process";
import os from "node:os";
import process from "node:process";

const COMMAND_TIMEOUT_MS = 1500;
const TERMINAL_APP_NAMES = [
  "terminal",
  "iterm2",
  "warp",
  "kitty",
  "alacritty",
  "wezterm",
  "ghostty",
  "gnome-terminal",
  "konsole",
  "xterm",
];

export function getCodexActiveState() {
  const forced = parseForcedCodexActive();
  if (forced !== null) {
    return { available: true, active: forced, source: "env" };
  }

  if (process.platform === "darwin") {
    return getMacCodexActiveState();
  }

  if (process.platform === "linux") {
    return getLinuxCodexActiveState();
  }

  return unavailable(`Unsupported platform: ${process.platform}`);
}

function getMacCodexActiveState() {
  const frontmost = runCommand("osascript", [
    "-e",
    'tell application "System Events" to get name of first application process whose frontmost is true',
  ]);

  if (!frontmost.ok) {
    return unavailable(frontmost.error);
  }

  const appName = frontmost.stdout.trim();
  if (isCodexText(appName)) {
    return { available: true, active: true, source: "macos-frontmost-app", detail: appName };
  }

  if (isTerminalText(appName) && processAncestryContainsCodex()) {
    return { available: true, active: true, source: "macos-frontmost-terminal", detail: appName };
  }

  return { available: true, active: false, source: "macos-frontmost-app", detail: appName };
}

function getLinuxCodexActiveState() {
  const focusedWindow = getLinuxFocusedWindowText();
  if (!focusedWindow.available) {
    return focusedWindow;
  }

  if (isCodexText(focusedWindow.text)) {
    return { available: true, active: true, source: focusedWindow.source, detail: focusedWindow.text };
  }

  if (isTerminalText(focusedWindow.text) && processAncestryContainsCodex()) {
    return { available: true, active: true, source: focusedWindow.source, detail: focusedWindow.text };
  }

  return { available: true, active: false, source: focusedWindow.source, detail: focusedWindow.text };
}

function getLinuxFocusedWindowText() {
  const xdotool = runCommand("sh", [
    "-c",
    "xdotool getactivewindow getwindowname getwindowclassname 2>/dev/null",
  ]);
  if (xdotool.ok && xdotool.stdout.trim()) {
    return { available: true, source: "linux-xdotool", text: xdotool.stdout.trim() };
  }

  const hyprctl = runCommand("hyprctl", ["activewindow", "-j"]);
  if (hyprctl.ok) {
    try {
      const parsed = JSON.parse(hyprctl.stdout);
      const text = [parsed.class, parsed.title].filter(Boolean).join("\n");
      if (text.trim()) {
        return { available: true, source: "linux-hyprctl", text };
      }
    } catch {
      // Fall through to the next detector.
    }
  }

  const sway = runCommand("swaymsg", ["-t", "get_tree"]);
  if (sway.ok) {
    try {
      const focused = findFocusedSwayNode(JSON.parse(sway.stdout));
      const text = focused ? swayNodeText(focused) : "";
      if (text.trim()) {
        return { available: true, source: "linux-swaymsg", text };
      }
    } catch {
      // Fall through to unavailable.
    }
  }

  return unavailable("Linux focused window detection is unavailable.");
}

function findFocusedSwayNode(node) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (node.focused) {
    return node;
  }

  for (const child of [...(node.nodes || []), ...(node.floating_nodes || [])]) {
    const focused = findFocusedSwayNode(child);
    if (focused) {
      return focused;
    }
  }

  return null;
}

function swayNodeText(node) {
  return [
    node.name,
    node.app_id,
    node.window_properties?.class,
    node.window_properties?.instance,
    node.window_properties?.title,
  ]
    .filter(Boolean)
    .join("\n");
}

function processAncestryContainsCodex() {
  let pid = process.pid;

  for (let depth = 0; depth < 25 && pid > 1; depth += 1) {
    const result = runCommand("ps", ["-o", "ppid=,comm=", "-p", String(pid)]);
    if (!result.ok) {
      return false;
    }

    const line = result.stdout.trim();
    if (!line) {
      return false;
    }

    if (isCodexText(line)) {
      return true;
    }

    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      return false;
    }

    pid = Number(match[1]);
  }

  return false;
}

function parseForcedCodexActive() {
  const value = process.env.CODEX_TELEGRAM_FORCE_CODEX_ACTIVE;
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function isCodexText(value) {
  return /\bcodex\b/i.test(String(value || ""));
}

function isTerminalText(value) {
  const normalized = String(value || "").toLowerCase();
  return TERMINAL_APP_NAMES.some((name) => normalized.includes(name));
}

function runCommand(command, args) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: COMMAND_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      cwd: os.homedir(),
    });

    if (result.error) {
      return { ok: false, error: result.error.message };
    }

    if (result.status !== 0) {
      return { ok: false, error: result.stderr.trim() || `${command} exited with code ${result.status}` };
    }

    return { ok: true, stdout: result.stdout };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function unavailable(reason) {
  return { available: false, active: null, source: "unavailable", reason };
}

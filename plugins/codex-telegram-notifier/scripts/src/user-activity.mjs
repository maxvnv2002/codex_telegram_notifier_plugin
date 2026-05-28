import { spawnSync } from "node:child_process";
import os from "node:os";

const COMMAND_TIMEOUT_MS = 1500;

export function getUserIdleMs() {
  const forced = Number(process.env.CODEX_TELEGRAM_FORCE_IDLE_MS);
  if (Number.isFinite(forced) && forced >= 0) {
    return { available: true, idleMs: forced, source: "env" };
  }

  if (process.platform === "darwin") {
    return getMacIdleMs();
  }

  if (process.platform === "linux") {
    return getLinuxIdleMs();
  }

  if (process.platform === "win32") {
    return getWindowsIdleMs();
  }

  return unavailable(`Unsupported platform: ${process.platform}`);
}

function getMacIdleMs() {
  const result = runCommand("ioreg", ["-c", "IOHIDSystem"]);
  if (!result.ok) {
    return unavailable(result.error);
  }

  const match = result.stdout.match(/"HIDIdleTime"\s*=\s*(\d+)/);
  if (!match) {
    return unavailable("HIDIdleTime not found");
  }

  return { available: true, idleMs: Number(BigInt(match[1]) / 1000000n), source: "macos-ioreg" };
}

function getLinuxIdleMs() {
  const xprintidle = runCommand("xprintidle", []);
  if (xprintidle.ok) {
    const idleMs = Number(xprintidle.stdout.trim());
    if (Number.isFinite(idleMs) && idleMs >= 0) {
      return { available: true, idleMs, source: "linux-xprintidle" };
    }
  }

  const gnome = runCommand("gdbus", [
    "call",
    "--session",
    "--dest",
    "org.gnome.Mutter.IdleMonitor",
    "--object-path",
    "/org/gnome/Mutter/IdleMonitor/Core",
    "--method",
    "org.gnome.Mutter.IdleMonitor.GetIdletime",
  ]);
  if (gnome.ok) {
    const match = gnome.stdout.match(/uint64\s+(\d+)/) || gnome.stdout.match(/\((\d+),?\)/);
    if (match) {
      const idleMs = Number(match[1]);
      if (Number.isFinite(idleMs) && idleMs >= 0) {
        return { available: true, idleMs, source: "linux-gnome-idle-monitor" };
      }
    }
  }

  return unavailable("Linux idle time is unavailable. Install xprintidle for X11, or use GNOME IdleMonitor.");
}

function getWindowsIdleMs() {
  const command = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class IdleTime {
  [StructLayout(LayoutKind.Sequential)]
  struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }
  [DllImport("user32.dll")]
  static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  public static uint GetIdleMs() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(info);
    GetLastInputInfo(ref info);
    return ((uint)Environment.TickCount - info.dwTime);
  }
}
"@
[IdleTime]::GetIdleMs()
`;

  const result = runCommand("powershell.exe", ["-NoProfile", "-Command", command]);
  if (!result.ok) {
    return unavailable(result.error);
  }

  const idleMs = Number(result.stdout.trim());
  if (!Number.isFinite(idleMs) || idleMs < 0) {
    return unavailable("Windows idle output is invalid");
  }

  return { available: true, idleMs, source: "windows-last-input" };
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
  return { available: false, idleMs: null, source: "unavailable", reason };
}

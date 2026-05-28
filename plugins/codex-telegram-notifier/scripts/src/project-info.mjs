import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { getFirstString } from "./hook-input.mjs";

export function resolveProjectCwd(hookInput) {
  const fromInput = getFirstString(hookInput, [
    ["cwd"],
    ["project_dir"],
    ["projectDir"],
    ["workspace"],
    ["workspace_dir"],
    ["workspaceDir"],
  ]);
  return fromInput || process.env.CLAUDE_PROJECT_DIR || process.env.PWD || process.cwd();
}

export function resolveProjectName(cwd) {
  const gitRoot = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  const base = gitRoot || cwd;
  return path.basename(base) || "unknown";
}

export function resolveGitBranch(cwd) {
  const branch = runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch && branch !== "HEAD") {
    return branch;
  }
  return runGit(cwd, ["rev-parse", "--short", "HEAD"]) || null;
}

function runGit(cwd, args) {
  try {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status !== 0) {
      return null;
    }
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

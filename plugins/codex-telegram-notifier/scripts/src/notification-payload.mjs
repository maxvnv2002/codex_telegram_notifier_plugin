import process from "node:process";
import { getFirstString, resolveNotificationMessage } from "./hook-input.mjs";
import { resolveGitBranch, resolveProjectCwd, resolveProjectName } from "./project-info.mjs";

export function buildNotificationPayload(config, hookInput) {
  const cwd = resolveProjectCwd(hookInput);

  return {
    deviceId: config.deviceId,
    deviceName: config.deviceName,
    projectName: resolveProjectName(cwd),
    gitBranch: resolveGitBranch(cwd),
    codexSessionId: resolveSessionId(hookInput),
    codexTurnId: resolveTurnId(hookInput),
    model: resolveModel(hookInput),
    finishedAt: new Date().toISOString(),
    message: resolveNotificationMessage(hookInput),
  };
}

function resolveSessionId(hookInput) {
  return (
    getFirstString(hookInput, [
      ["session_id"],
      ["sessionId"],
      ["session", "id"],
      ["codexSessionId"],
    ]) ||
    process.env.CODEX_SESSION_ID ||
    null
  );
}

function resolveTurnId(hookInput) {
  return (
    getFirstString(hookInput, [
      ["turn_id"],
      ["turnId"],
      ["turn", "id"],
      ["codexTurnId"],
    ]) ||
    process.env.CODEX_TURN_ID ||
    null
  );
}

function resolveModel(hookInput) {
  return (
    getFirstString(hookInput, [
      ["model"],
      ["model_name"],
      ["modelName"],
      ["metadata", "model"],
    ]) ||
    process.env.CODEX_MODEL ||
    null
  );
}

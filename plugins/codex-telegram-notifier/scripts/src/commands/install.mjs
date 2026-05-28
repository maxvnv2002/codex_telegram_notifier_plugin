import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import process from "node:process";
import { stringOption } from "../args.mjs";
import { isConfigured, loadConfig, resolveConfigPath } from "../config.mjs";
import { setupCommand } from "./setup.mjs";

const MARKETPLACE_NAME = "local-codex-telegram";
const PLUGIN_NAME = "codex-telegram-notifier";

export async function installCommand(args) {
  const pluginRoot = resolvePluginRoot();
  const marketplaceRoot = resolveMarketplaceRoot(args);
  const codexConfigPath = resolveCodexConfigPath(args);

  createLocalMarketplace(pluginRoot, marketplaceRoot);

  if (!args["skip-codex-config"]) {
    updateCodexConfig(codexConfigPath, marketplaceRoot);
  }

  if (!args["skip-setup"]) {
    const setupArgs = await buildSetupArgs(args);
    await setupCommand(setupArgs);
  }

  console.log("");
  console.log("Codex plugin installed locally.");
  console.log(`Marketplace: ${marketplaceRoot}`);
  console.log(`Codex config: ${codexConfigPath}`);
  console.log("Restart Codex Desktop so it reloads the local marketplace and hooks.");
}

function resolvePluginRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../../..");
}

function resolveMarketplaceRoot(args) {
  const configured = stringOption(args, "marketplace-root");
  if (configured) {
    return path.resolve(expandHome(configured));
  }
  return path.join(os.homedir(), ".codex", "plugins", MARKETPLACE_NAME);
}

function resolveCodexConfigPath(args) {
  const configured = stringOption(args, "codex-config");
  if (configured) {
    return path.resolve(expandHome(configured));
  }
  return path.join(os.homedir(), ".codex", "config.toml");
}

function createLocalMarketplace(pluginRoot, marketplaceRoot) {
  const agentsDir = path.join(marketplaceRoot, ".agents", "plugins");
  const pluginsDir = path.join(marketplaceRoot, "plugins");
  const pluginLink = path.join(pluginsDir, PLUGIN_NAME);

  mkdirSync(agentsDir, { recursive: true });
  mkdirSync(pluginsDir, { recursive: true });

  ensurePluginSymlink(pluginRoot, pluginLink);
  writeMarketplaceJson(path.join(agentsDir, "marketplace.json"));
}

function ensurePluginSymlink(pluginRoot, pluginLink) {
  if (existsSync(pluginLink)) {
    const stat = lstatSync(pluginLink);
    const pointsToCurrentPlugin = stat.isSymbolicLink() && realpathSync(pluginLink) === realpathSync(pluginRoot);

    if (pointsToCurrentPlugin) {
      return;
    }

    if (stat.isSymbolicLink()) {
      unlinkSync(pluginLink);
    } else {
      throw new Error(`Cannot replace existing non-symlink path: ${pluginLink}`);
    }
  }

  symlinkSync(pluginRoot, pluginLink, "dir");
}

function writeMarketplaceJson(marketplacePath) {
  const marketplace = {
    name: MARKETPLACE_NAME,
    interface: {
      displayName: "Local Codex Telegram",
    },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: {
          source: "local",
          path: `./plugins/${PLUGIN_NAME}`,
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Productivity",
      },
    ],
  };

  writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);
}

function updateCodexConfig(configPath, marketplaceRoot) {
  mkdirSync(path.dirname(configPath), { recursive: true });

  const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const additions = [];

  if (!existing.includes(`[marketplaces.${MARKETPLACE_NAME}]`)) {
    additions.push(`[marketplaces.${MARKETPLACE_NAME}]
source_type = "local"
source = "${escapeTomlString(marketplaceRoot)}"`);
  }

  if (!existing.includes(`[plugins."${PLUGIN_NAME}@${MARKETPLACE_NAME}"]`)) {
    additions.push(`[plugins."${PLUGIN_NAME}@${MARKETPLACE_NAME}"]
enabled = true`);
  }

  if (additions.length === 0) {
    return;
  }

  const separator = existing.trim() ? "\n\n" : "";
  writeFileSync(configPath, `${existing.replace(/\s*$/, "")}${separator}${additions.join("\n\n")}\n`);
}

async function buildSetupArgs(args) {
  const setupArgs = {
    ...args,
    _: [],
  };
  const pairingCode = await resolvePairingCode(setupArgs);

  if (pairingCode) {
    setupArgs["pairing-code"] = pairingCode;
  }

  return setupArgs;
}

async function resolvePairingCode(args) {
  const fromArgs =
    stringOption(args, "pairing-code") ||
    stringOption(args, "pairingCode") ||
    args._[0] ||
    process.env.CODEX_TELEGRAM_PAIRING_CODE;

  if (fromArgs) {
    return fromArgs;
  }

  if (isConfigured(loadConfig(resolveConfigPath(args)))) {
    return "";
  }

  if (!process.stdin.isTTY) {
    throw new Error("Missing pairing code. Run install --pairing-code CODE.");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (await rl.question("Pairing code from Telegram (/newcode): ")).trim();
  } finally {
    rl.close();
  }
}

function escapeTomlString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
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

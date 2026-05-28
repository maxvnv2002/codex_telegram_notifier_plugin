import { parseArgs } from "./args.mjs";
import { printHelp } from "./help.mjs";
import { installCommand } from "./commands/install.mjs";
import { notifyCommand, testCommand } from "./commands/notify.mjs";
import { setupCommand } from "./commands/setup.mjs";
import { statusCommand } from "./commands/status.mjs";
import { turnEndedCommand } from "./commands/turn-ended.mjs";

export async function main(argv) {
  const command = argv[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  const args = parseArgs(argv.slice(1));

  if (command === "install") {
    await installCommand(args);
    return;
  }

  if (command === "notifier_start" || command === "/notifier_start") {
    await setupCommand(args);
    return;
  }

  if (command === "setup") {
    await setupCommand(args);
    return;
  }

  if (command === "status") {
    statusCommand(args);
    return;
  }

  if (command === "notify") {
    await notifyCommand(args);
    return;
  }

  if (command === "turn-ended") {
    await turnEndedCommand(args);
    return;
  }

  if (command === "test") {
    await testCommand(args);
    return;
  }

  throw new Error(`Unknown command: ${command}. Run --help for usage.`);
}

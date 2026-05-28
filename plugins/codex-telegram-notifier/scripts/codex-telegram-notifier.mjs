#!/usr/bin/env node

import { main } from "./src/cli.mjs";
import { errorMessage } from "./src/errors.mjs";

main(process.argv.slice(2)).catch((error) => {
  console.error(`codex-telegram-notifier: ${errorMessage(error)}`);
  process.exitCode = 1;
});

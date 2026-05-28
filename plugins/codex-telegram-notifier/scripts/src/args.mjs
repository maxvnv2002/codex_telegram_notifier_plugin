export function parseArgs(argv) {
  const result = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith("--")) {
      result._.push(item);
      continue;
    }

    const eqIndex = item.indexOf("=");
    if (eqIndex !== -1) {
      result[item.slice(2, eqIndex)] = item.slice(eqIndex + 1);
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }

  return result;
}

export function stringOption(args, key) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

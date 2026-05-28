export function normalizePairingCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

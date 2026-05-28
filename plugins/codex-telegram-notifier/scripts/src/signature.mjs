import { createHmac } from "node:crypto";

export function createSignature(timestamp, rawBody, secret) {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `sha256=${digest}`;
}

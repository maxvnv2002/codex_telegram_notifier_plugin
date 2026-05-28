import { HTTP_TIMEOUT_MS } from "./constants.mjs";

export async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  let body;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
    headers["Content-Type"] = "application/json";
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body,
      signal: controller.signal,
    });

    const payload = await parseJsonResponse(response);

    if (!response.ok || payload.ok === false) {
      const reason = payload.error || payload.description || response.statusText || "Request failed";
      throw new Error(`${response.status} ${reason}`);
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${HTTP_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

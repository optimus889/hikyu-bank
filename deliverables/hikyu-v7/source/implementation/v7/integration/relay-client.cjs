const fs = require("fs"),
  path = require("path"),
  C = require("./contracts.cjs");
const ROOT = path.resolve(__dirname, "../../..");
function configuration() {
  return JSON.parse(
    fs.readFileSync(ROOT + "/private/v7-integration.json", "utf8"),
  );
}
async function call(operation, payload = {}) {
  const c = configuration();
  if (!c.enabled || !c.relay_url)
    throw new C.IntegrationError(
      503,
      "RELAY_NOT_CONFIGURED",
      "The external integration is not configured",
      false,
    );
  const u = new URL(c.relay_url);
  if (
    u.protocol !== "https:" &&
    !(
      process.env.V7_ALLOW_LOCAL_RELAY_TEST === "true" &&
      u.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(u.hostname)
    )
  )
    throw new C.IntegrationError(
      422,
      "HTTPS_REQUIRED",
      "A secure relay endpoint is required",
    );
  if (u.username || u.password || u.search || u.hash)
    throw new C.IntegrationError(
      422,
      "UNSAFE_RELAY_URL",
      "The relay URL must not contain credentials or signed query parameters",
    );
  const envelope = C.signEnvelope(
    "app",
    operation,
    payload,
    c.relay_app_secret,
  );
  let response;
  try {
    response = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new C.IntegrationError(
      503,
      "RELAY_NETWORK_FAILURE",
      "Relay request failed",
      true,
    );
  }
  if (!response.ok)
    throw new C.IntegrationError(
      response.status,
      response.status === 401 || response.status === 403
        ? "RELAY_AUTH_REQUIRED"
        : "RELAY_HTTP_FAILURE",
      "Relay request failed",
      [408, 425, 429].includes(response.status) || response.status >= 500,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new C.IntegrationError(
      502,
      "RELAY_INVALID_RESPONSE",
      "The relay returned invalid JSON",
      true,
    );
  }
  if (!data.ok) {
    const e = data.error || {};
    throw new C.IntegrationError(
      Number(e.status) || 502,
      /^[A-Z_]{3,60}$/.test(e.code || "") ? e.code : "RELAY_REJECTED",
      "Relay rejected the operation",
      e.retryable === true,
    );
  }
  return data.data;
}
module.exports = { call, configuration };

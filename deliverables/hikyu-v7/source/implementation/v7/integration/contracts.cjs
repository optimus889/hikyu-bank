const crypto = require("crypto");
class IntegrationError extends Error {
  constructor(status, code, message, retryable = false) {
    super(message);
    Object.assign(this, { status, code, retryable });
  }
}
const fail = (code, message, status = 422) => {
  throw new IntegrationError(status, code, message);
};
function clean(value, name, max, minimum = 1) {
  if (typeof value !== "string")
    fail("INVALID_" + name.toUpperCase(), "Invalid " + name);
  const v = value.trim();
  if (v.length < minimum || v.length > max)
    fail("INVALID_" + name.toUpperCase(), "Invalid " + name);
  return v;
}
function instant(v, name = "submitted_at") {
  v = clean(v, name, 64);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(
      v,
    ) ||
    !Number.isFinite(Date.parse(v))
  )
    fail("INVALID_TIMESTAMP", "Use an ISO 8601 timestamp with a timezone");
  const parts = v
    .match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/)
    .slice(1)
    .map(Number);
  if (
    parts[1] < 1 ||
    parts[1] > 12 ||
    parts[2] < 1 ||
    parts[2] > new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate() ||
    parts[3] > 23 ||
    parts[4] > 59 ||
    parts[5] > 59
  )
    fail("INVALID_TIMESTAMP", "Invalid calendar timestamp");
  const d = new Date(v);
  if (d.getTime() > Date.now() + 300000)
    fail("FUTURE_TIMESTAMP", "Submission timestamp is in the future");
  return d.toISOString();
}
function normalizeIntake(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INVALID_PAYLOAD", "Expected an object");
  const allowed = new Set([
    "source_type",
    "source_namespace",
    "source_event_id",
    "subject",
    "description",
    "submitted_at",
    "source_reference",
  ]);
  for (const k of Object.keys(input))
    if (!allowed.has(k))
      fail(
        "UNSUPPORTED_FIELD",
        "External identity or transaction binding fields are not accepted",
      );
  const source_type = clean(input.source_type, "source_type", 20);
  if (!["form", "email"].includes(source_type))
    fail("INVALID_SOURCE_TYPE", "Use form or email");
  const out = {
    source_type,
    source_namespace: clean(input.source_namespace, "source_namespace", 160),
    source_event_id: clean(input.source_event_id, "source_event_id", 200),
    subject: clean(input.subject, "subject", 200),
    description: clean(input.description, "description", 2000, 3),
    submitted_at: instant(input.submitted_at),
    source_reference:
      input.source_reference == null
        ? ""
        : clean(input.source_reference, "source_reference", 200, 0),
  };
  return out;
}
const digest = (v) =>
  crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const sourceKey = (v) =>
  JSON.stringify([v.source_type, v.source_namespace, v.source_event_id]);
function normalizeOutcome(v) {
  const allowed = new Set([
    "delivery_id",
    "case_id",
    "state_version",
    "final_state",
    "case_processed_at",
  ]);
  if (
    !v ||
    typeof v !== "object" ||
    Object.keys(v).some((k) => !allowed.has(k))
  )
    fail("INVALID_OUTCOME", "Outcome contains unsupported fields");
  const delivery_id = clean(v.delivery_id, "delivery_id", 180),
    case_id = clean(v.case_id, "case_id", 80),
    state_version = Number(v.state_version),
    final_state = clean(v.final_state, "final_state", 20);
  if (!Number.isSafeInteger(state_version) || state_version < 1)
    fail("INVALID_VERSION", "Invalid state version");
  if (!["COMPLETED", "REJECTED"].includes(final_state))
    fail(
      "NON_TERMINAL_STATE",
      "Only persisted terminal outcomes may be synchronized",
    );
  return {
    delivery_id,
    case_id,
    state_version,
    final_state,
    case_processed_at: instant(v.case_processed_at, "case_processed_at"),
  };
}
function signEnvelope(
  client,
  operation,
  payload,
  secret,
  { timestamp = Date.now(), nonce = crypto.randomUUID() } = {},
) {
  const body = JSON.stringify({ operation, payload });
  const message = [client, String(timestamp), nonce, body].join("\n");
  return {
    client,
    timestamp: String(timestamp),
    nonce,
    body,
    signature: crypto
      .createHmac("sha256", secret)
      .update(message)
      .digest("hex"),
  };
}
function verifyEnvelope(envelope, keys, nonces = new Set()) {
  if (!envelope || !keys[envelope.client])
    throw new IntegrationError(401, "AUTH_REQUIRED", "Authentication failed");
  const { client, timestamp, nonce, body, signature } = envelope;
  if (
    !Number.isFinite(Number(timestamp)) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    typeof nonce !== "string" ||
    typeof body !== "string" ||
    body.length > 65536 ||
    !/^\w[\w-]{7,100}$/.test(nonce) ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new IntegrationError(
      401,
      "INVALID_SIGNATURE",
      "Authentication failed",
    );
  const expected = crypto
    .createHmac("sha256", keys[client])
    .update([client, timestamp, nonce, body].join("\n"))
    .digest("hex");
  if (
    !crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex"),
    )
  )
    throw new IntegrationError(
      401,
      "INVALID_SIGNATURE",
      "Authentication failed",
    );
  if (nonces.has(client + ":" + nonce))
    throw new IntegrationError(409, "REPLAYED_ENVELOPE", "Replay rejected");
  nonces.add(client + ":" + nonce);
  try {
    return { client, ...JSON.parse(body) };
  } catch {
    fail("INVALID_JSON", "Invalid request body", 400);
  }
}
function classifyRemote(error) {
  if (error instanceof IntegrationError) return error;
  return new IntegrationError(
    503,
    "TEMPORARY_REMOTE_FAILURE",
    "Temporary remote request failure",
    true,
  );
}
module.exports = {
  IntegrationError,
  normalizeIntake,
  normalizeOutcome,
  digest,
  sourceKey,
  instant,
  clean,
  signEnvelope,
  verifyEnvelope,
  classifyRemote,
};

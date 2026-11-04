const crypto = require("crypto"),
  C = require("./contracts.cjs");
async function relay(z, bundle, operation, payload) {
  const url = bundle.authData.relay_url;
  if (
    !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      url || "",
    )
  )
    throw new z.errors.Error(
      "Use the newly deployed Google Apps Script /exec URL.",
      "INVALID_RELAY_URL",
      400,
    );
  const client = "zapier",
    timestamp = String(Date.now()),
    nonce = crypto.randomUUID(),
    body = JSON.stringify({ operation, payload }),
    signature = crypto
      .createHmac("sha256", bundle.authData.relay_secret)
      .update([client, timestamp, nonce, body].join("\n"))
      .digest("hex");
  const response = await z.request({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client, timestamp, nonce, body, signature }),
  });
  response.throwForStatus();
  const value = response.json;
  if (!value || !value.ok) {
    const err = value?.error || {};
    throw new z.errors.Error(
      "Relay operation failed: " + (err.code || "INVALID_RESPONSE"),
      err.code || "INVALID_RESPONSE",
      err.status || 503,
    );
  }
  return value.data;
}
const intakeFields = [
  "source_type",
  "source_namespace",
  "source_event_id",
  "subject",
  "description",
  "submitted_at",
  "source_reference",
];
module.exports = {
  version: require("./package.json").version,
  platformVersion: require("zapier-platform-core").version,
  authentication: {
    type: "custom",
    fields: [
      {
        key: "relay_url",
        label: "V7 Relay URL",
        required: true,
        type: "string",
        helpText: "New authenticated relay only; no Saltcorn URL.",
      },
      {
        key: "relay_secret",
        label: "V7 Zapier Relay Secret",
        required: true,
        type: "password",
        helpText:
          "Use the dedicated ZAPIER_SECRET through this secure connection field; never map it as step input.",
      },
    ],
    test: async (z, b) => relay(z, b, "connection.test", {}),
    connectionLabel: "Hikyu V7 relay",
  },
  triggers: {
    outcomes: {
      key: "outcomes",
      noun: "Persisted Support Outcome",
      display: {
        label: "New Persisted Terminal Support Outcome",
        description:
          "Poll authenticated relay for terminal outcomes already captured from Saltcorn.",
      },
      operation: {
        type: "polling",
        perform: async (z, b) => (await relay(z, b, "outcome.poll", {})).items,
        sample: {
          id: "synthetic-case:r0",
          delivery_id: "synthetic-case:r0",
          case_id: "v6-synthetic-demo",
          state_version: 3,
          final_state: "COMPLETED",
          case_processed_at: "2026-11-04T00:00:00.000Z",
        },
      },
    },
  },
  creates: {
    stage_intake: {
      key: "stage_intake",
      noun: "Support Draft",
      display: {
        label: "Stage External Support Draft",
        description:
          "Map, trim, validate and normalize a synthetic request; never accept identity or transaction ownership.",
      },
      operation: {
        inputFields: intakeFields.map((key) => ({
          key,
          type: "string",
          required: key !== "source_reference",
        })),
        perform: async (z, b) => {
          const p = {};
          intakeFields.forEach((k) => {
            if (b.inputData[k] !== undefined)
              p[k] = String(b.inputData[k]).trim();
          });
          let normalized;
          try {
            normalized = C.normalizeIntake(p);
          } catch (e) {
            throw new z.errors.Error(e.message, e.code, e.status || 422);
          }
          return relay(z, b, "intake.stage", normalized);
        },
        sample: { id: "synthetic-stage-id", replayed: false },
      },
    },
    apply_outcome: {
      key: "apply_outcome",
      noun: "External Case Outcome",
      display: {
        label: "Upsert External Support Outcome",
        description:
          "Apply a published terminal outcome to ExternalCases once and persist a separate synchronization receipt.",
      },
      operation: {
        inputFields: [
          "delivery_id",
          "case_id",
          "state_version",
          "final_state",
          "case_processed_at",
        ].map((key) => ({
          key,
          type: key === "state_version" ? "integer" : "string",
          required: true,
        })),
        perform: async (z, b) => {
          const p = {};
          [
            "delivery_id",
            "case_id",
            "state_version",
            "final_state",
            "case_processed_at",
          ].forEach((k) => (p[k] = b.inputData[k]));
          return relay(z, b, "outcome.apply", p);
        },
        sample: {
          receipt_id: "synthetic-case:r0",
          case_id: "v6-synthetic-demo",
          result: "SYNCED",
        },
      },
    },
  },
};

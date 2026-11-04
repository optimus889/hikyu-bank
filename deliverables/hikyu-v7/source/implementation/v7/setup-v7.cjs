const path = require("path"),
  fs = require("fs"),
  crypto = require("crypto");
const ROOT = path.resolve(__dirname, "../..");
const {
  init,
  db,
  Table,
  Field,
  View,
  Page,
  state,
} = require("../saltcorn/sdk.cjs");
(async () => {
  await init();
  const S = (name, label) => ({
      name,
      label,
      type: "String",
      attributes: { min_role_write: 1 },
    }),
    I = (name, label) => ({
      name,
      label,
      type: "Integer",
      attributes: { min_role_write: 1 },
    }),
    D = (name, label) => ({
      name,
      label,
      type: "Date",
      attributes: { min_role_write: 1 },
    }),
    K = (name, label, to) => ({
      name,
      label,
      type: "Key",
      reftable_name: to,
      attributes: { summary_field: "id", min_role_write: 1 },
    });
  const tables = {
    support_inbox: [
      S("source_type", "Source type"),
      S("source_namespace", "Source collection"),
      S("source_event_id", "Source event ID"),
      S("subject", "Subject"),
      S("description", "Description"),
      D("submitted_at", "Source submitted at"),
      S("source_reference", "Source reference"),
      S("payload_hash", "Private payload hash"),
      S("draft_status", "Draft status"),
      K("assigned_user_id", "Assigned user", "users"),
      K("claimed_by", "Claimed by", "users"),
      D("claimed_at", "Claimed at"),
      S("case_business_id", "Case number"),
      K("support_request_id", "Support request", "support_requests"),
      I("selected_transaction_id", "Confirmed transaction"),
      S("confirmed_description", "Confirmed description"),
      I("draft_version", "Draft version"),
      D("created_at", "Created at"),
      D("updated_at", "Updated at"),
      S("error_code", "Submission error"),
    ],
    v7_case_sync: [
      K("support_request_id", "Support request", "support_requests"),
      S("case_id", "Case number"),
      I("state_version", "Business state version"),
      S("sync_status", "External synchronization status"),
      I("attempts", "Attempt count"),
      D("last_attempt_at", "Last attempt"),
      D("next_attempt_at", "Next retry"),
      D("synced_at", "Synchronized at"),
      S("external_record_id", "External case record"),
      S("error_code", "Error code"),
    ],
    v7_outbox: [
      S("event_id", "Outcome event ID"),
      S("delivery_id", "Delivery ID"),
      K("support_request_id", "Support request", "support_requests"),
      S("case_id", "Case number"),
      I("state_version", "State version"),
      S("final_state", "Persisted final state"),
      D("case_processed_at", "Case processed at"),
      S("job_status", "Delivery status"),
      I("generation", "Replay generation"),
      I("attempts", "Attempt count"),
      D("next_attempt_at", "Next attempt"),
      D("created_at", "Created at"),
      D("updated_at", "Updated at"),
      S("error_code", "Error code"),
    ],
    v7_receipts: [
      S("receipt_id", "Receipt ID"),
      S("delivery_id", "Delivery ID"),
      S("case_id", "Case number"),
      I("state_version", "State version"),
      S("receipt_result", "Receipt result"),
      S("external_record_id", "External record"),
      D("synced_at", "Synchronized at"),
      D("received_at", "Received at"),
    ],
    v7_audit: [
      S("correlation_id", "Correlation ID"),
      S("event_kind", "Event kind"),
      S("result_code", "Result code"),
      I("actor_id", "Local actor"),
      D("occurred_at", "Occurred at"),
    ],
  };
  for (const [name, fields] of Object.entries(tables)) {
    let t = Table.findOne(name);
    if (!t)
      t = await Table.create(name, { min_role_read: 1, min_role_write: 1 });
    for (const f of fields)
      if (
        !Table.findOne(name)
          .getFields()
          .some((x) => x.name === f.name)
      )
        await Field.create({ ...f, table_id: t.id });
    if (name === "support_inbox")
      await Table.findOne(name).update({
        ownership_field_id: Table.findOne(name)
          .getFields()
          .find((f) => f.name === "assigned_user_id").id,
        min_role_read: 1,
        min_role_write: 1,
      });
  }
  for (const sql of [
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_source_identity ON support_inbox(source_type,source_namespace,source_event_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_draft_case ON support_inbox(case_business_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_sync_case ON v7_case_sync(case_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_outbox_event ON v7_outbox(event_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_outbox_case_version ON v7_outbox(case_id,state_version)",
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_outbox_delivery ON v7_outbox(delivery_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS v7_receipt_identity ON v7_receipts(receipt_id)",
  ])
    await db.query(sql);
  const privateDir = ROOT + "/private";
  const file = privateDir + "/v7-integration.json";
  if (!fs.existsSync(file)) {
    const config = {
      enabled: false,
      relay_url: "",
      relay_app_secret: crypto.randomBytes(32).toString("hex"),
      relay_zapier_secret: crypto.randomBytes(32).toString("hex"),
      local_api_enabled: false,
      local_api_port: 8198,
      intake_api_key: crypto.randomBytes(32).toString("hex"),
      outcome_api_key: crypto.randomBytes(32).toString("hex"),
    };
    fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  }
  for (const [name, title, mode] of [
    ["support-inbox", "Support Inbox", "inbox"],
    ["case-synchronization", "Outcome Synchronization", "sync"],
  ]) {
    const vn = "V7_" + mode;
    if (!View.findOne({ name: vn }))
      await View.create({
        name: vn,
        viewtemplate: "Hikyu V7 Integrations",
        table_id: Table.findOne("support_inbox").id,
        min_role: 80,
        configuration: { mode },
      });
    if (!Page.findOne({ name }))
      await Page.create({
        name,
        title,
        description: title,
        min_role: 80,
        layout: {
          above: [
            {
              type: "blank",
              contents:
                "<style>.v6-panel{border:1px solid #c9dbee;border-radius:8px;padding:20px;margin:18px 0;background:white}body{background:#f4f8fc;color:#0b2d50}</style>",
              block: true,
            },
            { type: "view", view: vn, block: true },
          ],
        },
      });
  }
  for (const p of await Page.find()) {
    if (
      !p.layout?.above ||
      ["support-inbox", "case-synchronization"].includes(p.name)
    )
      continue;
    const label =
      '<p><a href="/page/support-inbox">Support Inbox</a> · <a href="/page/case-synchronization">Outcome Synchronization</a></p>';
    if (!JSON.stringify(p.layout).includes("/page/support-inbox")) {
      p.layout.above.splice(1, 0, {
        type: "blank",
        contents: label,
        block: true,
      });
      await Page.update(p.id, { layout: p.layout });
    }
  }
  await state.getState().setConfig("site_name", "Hikyu Bank V7");
  fs.writeFileSync(
    ROOT + "/evidence/v7-schema-migration.json",
    JSON.stringify(
      {
        tables: Object.keys(tables),
        financial_tables_changed: false,
        core_workflow_changed: false,
        default_external_connection_enabled: false,
        time: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "Created five V7 integration tables and indexes; external connection disabled until securely configured.",
  );
  await db.close();
})();

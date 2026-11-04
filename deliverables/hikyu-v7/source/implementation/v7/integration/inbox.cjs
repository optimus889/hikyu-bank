const crypto = require("crypto"),
  { db } = require("../../saltcorn/sdk.cjs");
const C = require("./contracts.cjs");
function actor(user) {
  const a = require("../../saltcorn/integration.cjs").actor(user);
  return { id: user.id, key: a.key };
}
const isStaff = (a) =>
  ["builder", "service_agent", "supervisor"].includes(a.key);
const isRequester = (a) => ["requester", "other_requester"].includes(a.key);
async function audit(correlation, kind, result, actorId = null) {
  await db.query(
    "INSERT INTO v7_audit(correlation_id,event_kind,result_code,actor_id,occurred_at) VALUES($1,$2,$3,$4,now())",
    [String(correlation || "unknown").slice(0, 240), kind, result, actorId],
  );
}
async function importEvent(input) {
  let v;
  try {
    v = C.normalizeIntake(input);
  } catch (e) {
    await audit(
      String(input?.source_event_id || "unknown").slice(0, 200),
      "INTAKE_REJECTED",
      e.code || "INVALID_PAYLOAD",
    );
    throw e;
  }
  const hash = C.digest(v);
  let result;
  await db.withTransaction(async () => {
    const inserted = await db.query(
      "INSERT INTO support_inbox(source_type,source_namespace,source_event_id,subject,description,submitted_at,source_reference,payload_hash,draft_status,case_business_id,draft_version,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'NEW',$9,1,now(),now()) ON CONFLICT(source_type,source_namespace,source_event_id) DO NOTHING RETURNING *",
      [
        v.source_type,
        v.source_namespace,
        v.source_event_id,
        v.subject,
        v.description,
        v.submitted_at,
        v.source_reference,
        hash,
        "v6-" + crypto.randomUUID(),
      ],
    );
    let row = inserted.rows[0];
    if (!row) {
      row = (
        await db.query(
          "SELECT * FROM support_inbox WHERE source_type=$1 AND source_namespace=$2 AND source_event_id=$3",
          [v.source_type, v.source_namespace, v.source_event_id],
        )
      ).rows[0];
      if (row.payload_hash !== hash)
        throw new C.IntegrationError(
          409,
          "SOURCE_EVENT_CONFLICT",
          "The source identity already exists with different content",
        );
      result = {
        draft_id: row.id,
        case_id: row.case_business_id,
        draft_status: row.draft_status,
        replayed: true,
      };
    } else
      result = {
        draft_id: row.id,
        case_id: row.case_business_id,
        draft_status: "NEW",
        replayed: false,
      };
    await audit(
      v.source_event_id,
      "INTAKE_ACCEPTED",
      result.replayed ? "DUPLICATE_IGNORED" : "DRAFT_CREATED",
    );
  });
  return result;
}
async function visible(user) {
  const a = actor(user);
  return (
    await db.query(
      isStaff(a)
        ? "SELECT * FROM support_inbox ORDER BY id DESC LIMIT 100"
        : "SELECT * FROM support_inbox WHERE assigned_user_id=$1 OR claimed_by=$1 ORDER BY id DESC LIMIT 100",
      isStaff(a) ? [] : [a.id],
    )
  ).rows;
}
function positive(v) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new C.IntegrationError(
      422,
      "INVALID_IDENTIFIER",
      "A positive integer identifier or version is required",
    );
  return n;
}
async function assign(user, id, target, expectedVersion) {
  positive(id);
  positive(target);
  positive(expectedVersion);
  const a = actor(user);
  if (!isStaff(a))
    throw new C.IntegrationError(
      403,
      "STAFF_REQUIRED",
      "Only authorized staff may assign a draft",
    );
  const fs = require("fs"),
    path = require("path");
  const users = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../../private/saltcorn-accounts.json"),
    ),
  );
  if (
    !users.some(
      (u) =>
        u.id === Number(target) &&
        ["requester", "other_requester"].includes(u.key),
    )
  )
    throw new C.IntegrationError(
      422,
      "INVALID_ASSIGNEE",
      "Choose an authorized requester",
    );
  let result;
  await db.withTransaction(async () => {
    const r = (
      await db.query("SELECT * FROM support_inbox WHERE id=$1 FOR UPDATE", [
        Number(id),
      ])
    ).rows[0];
    if (!r)
      throw new C.IntegrationError(404, "DRAFT_NOT_FOUND", "Draft not found");
    if (
      !["NEW", "ASSIGNED"].includes(r.draft_status) ||
      r.draft_version !== Number(expectedVersion)
    )
      throw new C.IntegrationError(
        409,
        "DRAFT_CHANGED",
        "Draft assignment has changed",
      );
    result = (
      await db.query(
        "UPDATE support_inbox SET assigned_user_id=$1,draft_status='ASSIGNED',draft_version=draft_version+1,updated_at=now() WHERE id=$2 RETURNING *",
        [Number(target), r.id],
      )
    ).rows[0];
    await audit(r.source_event_id, "DRAFT_ASSIGNED", "ASSIGNED", a.id);
  });
  return result;
}
async function claim(user, id, expectedVersion) {
  positive(id);
  positive(expectedVersion);
  const a = actor(user);
  if (!isRequester(a))
    throw new C.IntegrationError(
      403,
      "REQUESTER_REQUIRED",
      "Requester role required",
    );
  let result;
  await db.withTransaction(async () => {
    const r = (
      await db.query("SELECT * FROM support_inbox WHERE id=$1 FOR UPDATE", [
        Number(id),
      ])
    ).rows[0];
    if (!r || r.assigned_user_id !== a.id)
      throw new C.IntegrationError(
        403,
        "DRAFT_NOT_ASSIGNED",
        "This draft is not assigned to you",
      );
    if (r.draft_status === "CLAIMED" && r.claimed_by === a.id) {
      result = r;
      return;
    }
    if (
      r.draft_status !== "ASSIGNED" ||
      r.draft_version !== Number(expectedVersion)
    )
      throw new C.IntegrationError(409, "DRAFT_CHANGED", "Draft has changed");
    result = (
      await db.query(
        "UPDATE support_inbox SET claimed_by=$1,claimed_at=now(),draft_status='CLAIMED',draft_version=draft_version+1,updated_at=now() WHERE id=$2 RETURNING *",
        [a.id, r.id],
      )
    ).rows[0];
    await audit(r.source_event_id, "DRAFT_CLAIMED", "CLAIMED", a.id);
  });
  return result;
}
async function submit(user, input) {
  positive(input.id);
  positive(input.expected_version);
  const a = actor(user);
  if (!isRequester(a))
    throw new C.IntegrationError(
      403,
      "REQUESTER_REQUIRED",
      "Requester role required",
    );
  let draft;
  await db.withTransaction(async () => {
    const r = (
      await db.query("SELECT * FROM support_inbox WHERE id=$1 FOR UPDATE", [
        Number(input.id),
      ])
    ).rows[0];
    if (!r || r.assigned_user_id !== a.id || r.claimed_by !== a.id)
      throw new C.IntegrationError(
        403,
        "DRAFT_OWNERSHIP_MISMATCH",
        "Claim your assigned draft before submitting",
      );
    if (r.draft_status === "SUBMITTED") {
      draft = r;
      return;
    }
    if (
      !["CLAIMED", "SUBMISSION_FAILED"].includes(r.draft_status) ||
      r.draft_version !== Number(input.expected_version)
    )
      throw new C.IntegrationError(
        409,
        "DRAFT_CHANGED",
        "Draft has changed or submission is in progress",
      );
    const transaction = Number(input.transaction_id);
    if (!Number.isSafeInteger(transaction) || transaction < 1)
      throw new C.IntegrationError(
        422,
        "INVALID_TRANSACTION",
        "Choose your own transaction",
      );
    const found = (
      await db.query(
        "SELECT id FROM transactions WHERE id=$1 AND owner_id=$2",
        [transaction, a.id],
      )
    ).rows[0];
    if (!found)
      throw new C.IntegrationError(
        403,
        "TRANSACTION_OWNERSHIP_MISMATCH",
        "The selected transaction does not belong to you",
      );
    const description = C.clean(input.description, "description", 2000, 3);
    if (
      r.draft_status === "SUBMISSION_FAILED" &&
      (r.selected_transaction_id !== transaction ||
        r.confirmed_description !== description)
    )
      throw new C.IntegrationError(
        409,
        "FROZEN_SUBMISSION",
        "Retry the originally confirmed details; do not change a possibly submitted request",
      );
    draft = (
      await db.query(
        "UPDATE support_inbox SET selected_transaction_id=$1,confirmed_description=$2,draft_status='SUBMITTING',draft_version=draft_version+1,error_code=NULL,updated_at=now() WHERE id=$3 RETURNING *",
        [transaction, description, r.id],
      )
    ).rows[0];
    await audit(
      r.source_event_id,
      "DRAFT_CONFIRMATION",
      "OWNERSHIP_CONFIRMED",
      a.id,
    );
  });
  if (draft.draft_status === "SUBMITTED") return draft;
  try {
    const result = await require("../../saltcorn/integration.cjs").submit(
      user,
      {
        business_id: draft.case_business_id,
        transaction_id: draft.selected_transaction_id,
        description: draft.confirmed_description,
      },
    );
    const out = (
      await db.query(
        "UPDATE support_inbox SET support_request_id=$1,draft_status='SUBMITTED',draft_version=draft_version+1,error_code=NULL,updated_at=now() WHERE id=$2 RETURNING *",
        [result.id, draft.id],
      )
    ).rows[0];
    await audit(
      draft.source_event_id,
      "DRAFT_SUBMITTED",
      "FLOWABLE_SUBMITTED",
      a.id,
    );
    return out;
  } catch (e) {
    await db.query(
      "UPDATE support_inbox SET draft_status='SUBMISSION_FAILED',draft_version=draft_version+1,error_code=$1,updated_at=now() WHERE id=$2",
      [e.code || "SUBMISSION_FAILED", draft.id],
    );
    await audit(
      draft.source_event_id,
      "DRAFT_SUBMISSION_FAILED",
      Number(e.code) >= 500
        ? "TEMPORARY_UPSTREAM_FAILURE"
        : "SUBMISSION_REJECTED",
      a.id,
    );
    throw e;
  }
}
async function recoverInterrupted() {
  const r = await db.query(
    "UPDATE support_inbox SET draft_status='SUBMISSION_FAILED',draft_version=draft_version+1,error_code='INTERRUPTED_CONFIRMATION',updated_at=now() WHERE draft_status='SUBMITTING' AND updated_at<now()-interval '2 minutes' RETURNING source_event_id",
  );
  for (const row of r.rows)
    await audit(
      row.source_event_id,
      "DRAFT_RECOVERY",
      "RETRY_CONFIRMED_DETAILS",
    );
  return r.rows.length;
}
module.exports = {
  recoverInterrupted,
  actor,
  isStaff,
  isRequester,
  audit,
  importEvent,
  visible,
  assign,
  claim,
  submit,
};

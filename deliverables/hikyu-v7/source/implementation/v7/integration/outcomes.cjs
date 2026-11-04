const crypto = require("crypto"),
  { db } = require("../../saltcorn/sdk.cjs"),
  C = require("./contracts.cjs"),
  { audit, actor, isStaff } = require("./inbox.cjs");
async function captureTerminals() {
  let count = 0;
  await db.withTransaction(async () => {
    const rows = (
      await db.query(
        "SELECT r.* FROM support_requests r WHERE r.state IN ('COMPLETED','REJECTED') AND NOT EXISTS(SELECT 1 FROM v7_outbox o WHERE o.case_id=r.business_id AND o.state_version=r.sequence) ORDER BY r.id LIMIT 100",
      )
    ).rows;
    for (const r of rows) {
      const eid = crypto.randomUUID(),
        delivery = eid + ":r0";
      const ins = await db.query(
        "INSERT INTO v7_outbox(event_id,delivery_id,support_request_id,case_id,state_version,final_state,case_processed_at,job_status,generation,attempts,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING',0,0,now(),now()) ON CONFLICT(case_id,state_version) DO NOTHING RETURNING id",
        [eid, delivery, r.id, r.business_id, r.sequence, r.state, r.updated_at],
      );
      if (!ins.rows.length) continue;
      await db.query(
        "INSERT INTO v7_case_sync(support_request_id,case_id,state_version,sync_status,attempts) VALUES($1,$2,$3,'PENDING',0) ON CONFLICT(case_id) DO UPDATE SET state_version=EXCLUDED.state_version,sync_status='PENDING',attempts=0,error_code=NULL WHERE v7_case_sync.state_version<EXCLUDED.state_version",
        [r.id, r.business_id, r.sequence],
      );
      await audit(r.business_id, "OUTCOME_QUEUED", "PERSISTED_TERMINAL");
      count++;
    }
  });
  return count;
}
const payload = (r) =>
  C.normalizeOutcome({
    delivery_id: r.delivery_id,
    case_id: r.case_id,
    state_version: r.state_version,
    final_state: r.final_state,
    case_processed_at: new Date(r.case_processed_at).toISOString(),
  });
async function pending() {
  const rows = (
    await db.query(
      "SELECT * FROM v7_outbox WHERE job_status IN ('PENDING','RETRY_PENDING') AND (next_attempt_at IS NULL OR next_attempt_at<=now()) ORDER BY id LIMIT 50",
    )
  ).rows;
  return rows;
}
async function published(row) {
  await db.withTransaction(async () => {
    await db.query(
      "UPDATE v7_outbox SET job_status='WAITING_ZAPIER',updated_at=now(),error_code=NULL WHERE id=$1 AND delivery_id=$2 AND job_status IN ('PENDING','RETRY_PENDING')",
      [row.id, row.delivery_id],
    );
    await db.query(
      "UPDATE v7_case_sync SET sync_status='WAITING_ZAPIER',last_attempt_at=now(),error_code=NULL WHERE case_id=$1 AND state_version=$2",
      [row.case_id, row.state_version],
    );
    await audit(row.case_id, "OUTCOME_PUBLISHED", "WAITING_ZAPIER");
  });
}
async function failed(row, error) {
  const e = C.classifyRemote(error),
    tries = (row.attempts || 0) + 1,
    retry = e.retryable && tries < 6;
  await db.withTransaction(async () => {
    await db.query(
      "UPDATE v7_outbox SET job_status=$1,attempts=$2,next_attempt_at=$3,error_code=$4,updated_at=now() WHERE id=$5 AND delivery_id=$6",
      [
        retry ? "RETRY_PENDING" : "FAILED",
        tries,
        retry
          ? new Date(Date.now() + Math.min(60000, 1000 * 2 ** tries))
          : null,
        e.code,
        row.id,
        row.delivery_id,
      ],
    );
    await db.query(
      "UPDATE v7_case_sync SET sync_status=$1,attempts=$2,last_attempt_at=now(),next_attempt_at=$3,error_code=$4 WHERE case_id=$5 AND state_version=$6",
      [
        retry ? "RETRY_PENDING" : "FAILED",
        tries,
        retry
          ? new Date(Date.now() + Math.min(60000, 1000 * 2 ** tries))
          : null,
        e.code,
        row.case_id,
        row.state_version,
      ],
    );
    await audit(row.case_id, "OUTCOME_DELIVERY_FAILED", e.code);
  });
}
async function receipt(input) {
  const receipt_id = C.clean(input.receipt_id, "receipt_id", 200),
    delivery_id = C.clean(input.delivery_id, "delivery_id", 180),
    case_id = C.clean(input.case_id, "case_id", 80),
    result = C.clean(input.result, "result", 32);
  if (
    !["SYNCED", "ALREADY_APPLIED", "STALE_IGNORED", "FAILED"].includes(result)
  )
    throw new C.IntegrationError(
      422,
      "INVALID_RECEIPT",
      "Unsupported receipt result",
    );
  let answer;
  await db.withTransaction(async () => {
    const row = (
      await db.query(
        "SELECT * FROM v7_outbox WHERE delivery_id=$1 FOR UPDATE",
        [delivery_id],
      )
    ).rows[0];
    if (
      !row ||
      row.case_id !== case_id ||
      row.state_version !== Number(input.state_version)
    )
      throw new C.IntegrationError(
        409,
        "RECEIPT_CORRELATION_MISMATCH",
        "Receipt does not match the published case and version",
      );
    if (
      input.final_state !== row.final_state ||
      C.instant(input.case_processed_at, "case_processed_at") !==
        new Date(row.case_processed_at).toISOString()
    )
      throw new C.IntegrationError(
        409,
        "RECEIPT_PAYLOAD_MISMATCH",
        "Receipt outcome differs from the captured terminal record",
      );
    const old = (
      await db.query("SELECT * FROM v7_receipts WHERE receipt_id=$1", [
        receipt_id,
      ])
    ).rows[0];
    if (old) {
      if (old.delivery_id !== delivery_id || old.receipt_result !== result)
        throw new C.IntegrationError(
          409,
          "RECEIPT_ID_CONFLICT",
          "Receipt identity was reused",
        );
      answer = { replayed: true };
      return;
    }
    if (["ACKNOWLEDGED", "OBSOLETE"].includes(row.job_status))
      throw new C.IntegrationError(
        409,
        "FINAL_RECEIPT_ALREADY_APPLIED",
        "A finalized delivery cannot be overwritten by a late receipt",
      );
    const synced =
      result === "FAILED" ? null : C.instant(input.synced_at, "synced_at");
    const external =
      result === "FAILED"
        ? ""
        : C.clean(input.external_record_id, "external_record_id", 200);
    await db.query(
      "INSERT INTO v7_receipts(receipt_id,delivery_id,case_id,state_version,receipt_result,external_record_id,synced_at,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())",
      [
        receipt_id,
        delivery_id,
        case_id,
        row.state_version,
        result,
        external,
        synced,
      ],
    );
    if (result === "FAILED") {
      const errorCode =
        typeof input.error_code === "string" &&
        /^[A-Z_]{3,60}$/.test(input.error_code)
          ? input.error_code
          : "EXTERNAL_WRITE_FAILED";
      await db.query(
        "UPDATE v7_outbox SET job_status='FAILED',error_code=$1,updated_at=now() WHERE id=$2",
        [errorCode, row.id],
      );
      await db.query(
        "UPDATE v7_case_sync SET sync_status='FAILED',error_code=$1,last_attempt_at=now() WHERE case_id=$2 AND state_version=$3",
        [errorCode, case_id, row.state_version],
      );
    } else {
      await db.query(
        "UPDATE v7_outbox SET job_status=$1,error_code=NULL,updated_at=now() WHERE id=$2",
        [result === "STALE_IGNORED" ? "OBSOLETE" : "ACKNOWLEDGED", row.id],
      );
      await db.query(
        "UPDATE v7_case_sync SET sync_status=$1,synced_at=$2,external_record_id=$3,error_code=NULL WHERE case_id=$4 AND state_version=$5",
        [
          result === "STALE_IGNORED" ? "STALE_REMOTE_VERSION" : "SYNCED",
          synced,
          external,
          case_id,
          row.state_version,
        ],
      );
    }
    await audit(case_id, "OUTCOME_RECEIPT", result);
    answer = { replayed: false, result };
  });
  return answer;
}
async function replay(user, id) {
  if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw new C.IntegrationError(422,"INVALID_IDENTIFIER","A positive outcome identifier is required");
  const a = actor(user);
  if (!isStaff(a))
    throw new C.IntegrationError(
      403,
      "STAFF_REQUIRED",
      "Only authorized staff may replay an integration event",
    );
  let out;
  await db.withTransaction(async () => {
    const r = (
      await db.query("SELECT * FROM v7_outbox WHERE id=$1 FOR UPDATE", [
        Number(id),
      ])
    ).rows[0];
    if (!r)
      throw new C.IntegrationError(
        404,
        "OUTCOME_NOT_FOUND",
        "Outcome not found",
      );
    if (["ACKNOWLEDGED", "OBSOLETE"].includes(r.job_status))
      throw new C.IntegrationError(
        409,
        "ALREADY_FINALIZED",
        "This outcome has already been acknowledged",
      );
    const latest = (
      await db.query("SELECT * FROM support_requests WHERE id=$1", [
        r.support_request_id,
      ])
    ).rows[0];
    if (
      !latest ||
      latest.sequence !== r.state_version ||
      latest.state !== r.final_state
    )
      throw new C.IntegrationError(
        409,
        "OUTCOME_SUPERSEDED",
        "An old outcome cannot be replayed over a newer business version",
      );
    out = (
      await db.query(
        "UPDATE v7_outbox SET delivery_id=event_id||':r'||(generation+1),generation=generation+1,attempts=0,job_status='PENDING',next_attempt_at=NULL,error_code=NULL,updated_at=now() WHERE id=$1 RETURNING *",
        [r.id],
      )
    ).rows[0];
    await db.query(
      "UPDATE v7_case_sync SET sync_status='PENDING',attempts=0,error_code=NULL,next_attempt_at=NULL WHERE case_id=$1 AND state_version=$2",
      [r.case_id, r.state_version],
    );
    await audit(
      r.case_id,
      "OUTCOME_MANUAL_REPLAY",
      "NEW_DELIVERY_ATTEMPT",
      a.id,
    );
  });
  return out;
}
async function visible(user) {
  const a = actor(user);
  return (
    await db.query(
      isStaff(a)
        ? "SELECT s.*,r.state business_state,o.id outbox_id,o.job_status FROM v7_case_sync s JOIN support_requests r ON r.id=s.support_request_id JOIN v7_outbox o ON o.case_id=s.case_id AND o.state_version=s.state_version ORDER BY s.id DESC LIMIT 100"
        : "SELECT s.*,r.state business_state,o.id outbox_id,o.job_status FROM v7_case_sync s JOIN support_requests r ON r.id=s.support_request_id JOIN v7_outbox o ON o.case_id=s.case_id AND o.state_version=s.state_version WHERE r.owner_id=$1 ORDER BY s.id DESC LIMIT 100",
      isStaff(a) ? [] : [a.id],
    )
  ).rows;
}
module.exports = {
  captureTerminals,
  payload,
  pending,
  published,
  failed,
  receipt,
  replay,
  visible,
};

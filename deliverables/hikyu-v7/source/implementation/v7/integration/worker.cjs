const { init, db } = require("../../saltcorn/sdk.cjs"),
  inbox = require("./inbox.cjs"),
  outcomes = require("./outcomes.cjs"),
  relay = require("./relay-client.cjs");
async function tick() {
  await inbox.recoverInterrupted();
  const captured = await outcomes.captureTerminals();
  const c = relay.configuration();
  if (!c.enabled) return { captured, external: "disabled" };
  const counts = { captured, imported: 0, published: 0, receipts: 0 };
  const incoming = await relay.call("intake.poll", {});
  for (const item of incoming.items || []) {
    try {
      const result = await inbox.importEvent(item.payload);
      await relay.call("intake.ack", {
        relay_id: item.id,
        draft_id: result.draft_id,
        case_id: result.case_id,
      });
      counts.imported++;
    } catch (e) {
      if (e.retryable || Number(e.status) >= 500) throw e;
      await relay.call("intake.reject", {
        relay_id: item.id,
        error_code: e.code || "INTAKE_REJECTED",
      });
    }
  }
  for (const row of await outcomes.pending()) {
    try {
      await relay.call("outcome.publish", outcomes.payload(row));
      await outcomes.published(row);
      counts.published++;
    } catch (e) {
      await outcomes.failed(row, e);
    }
  }
  const receipts = await relay.call("receipt.poll", {});
  for (const item of receipts.items || []) {
    try {
      await outcomes.receipt(item);
      await relay.call("receipt.ack", { receipt_id: item.receipt_id });
      counts.receipts++;
    } catch (e) {
      await inbox.audit(
        item.case_id || "unknown",
        "RECEIPT_REJECTED",
        e.code || "INVALID_RECEIPT",
      );
      if (e.retryable || Number(e.status) >= 500) throw e;
    }
  }
  return counts;
}
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const monitorFile = path.resolve(
  __dirname,
  "../../../private/v7-transport-state.json",
);
async function monitoredTick() {
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(relay.configuration()))
    .digest("hex");
  let old = {};
  try {
    old = JSON.parse(fs.readFileSync(monitorFile));
  } catch {}
  if (old.configuration === fingerprint && old.state === "PAUSED") return;
  if (
    old.configuration === fingerprint &&
    old.next_retry_at &&
    Date.parse(old.next_retry_at) > Date.now()
  )
    return;
  try {
    const result = await tick();
    fs.writeFileSync(
      monitorFile,
      JSON.stringify({
        state: result.external === "disabled" ? "DISABLED" : "READY",
        configuration: fingerprint,
        checked_at: new Date().toISOString(),
        attempts: 0,
      }),
      { mode: 0o600 },
    );
  } catch (e) {
    const transient = e.retryable === true || !e.status,
      attempts = (old.attempts || 0) + 1;
    fs.writeFileSync(
      monitorFile,
      JSON.stringify({
        state: transient ? "RETRY_PENDING" : "PAUSED",
        configuration: fingerprint,
        checked_at: new Date().toISOString(),
        attempts,
        error_code: e.code || "TEMPORARY_FAILURE",
        next_retry_at: transient
          ? new Date(
              Date.now() + Math.min(60000, 1000 * 2 ** Math.min(attempts, 6)),
            ).toISOString()
          : null,
      }),
      { mode: 0o600 },
    );
    await inbox.audit(
      "relay",
      "RELAY_POLL_FAILED",
      e.code || "TEMPORARY_FAILURE",
    );
  }
}
async function run() {
  if (process.argv.includes("--resume"))
    try {
      fs.unlinkSync(monitorFile);
    } catch {}
  await init();
  if (process.argv.includes("--once")) {
    try {
      console.log(JSON.stringify(await tick()));
    } finally {
      await db.close();
    }
    return;
  }
  let busy = false;
  const loop = async () => {
    if (busy) return;
    busy = true;
    try {
      await monitoredTick();
    } catch {
      console.error("V7 monitor storage unavailable.");
    } finally {
      busy = false;
    }
  };
  await loop();
  setInterval(loop, 3000);
  console.log(
    "V7 integration worker started. External transport remains disabled until configured.",
  );
}
if (require.main === module)
  run().catch(() => {
    console.error(
      "Integration worker could not start. Inspect local configuration.",
    );
    process.exit(1);
  });
module.exports = { tick, monitoredTick };

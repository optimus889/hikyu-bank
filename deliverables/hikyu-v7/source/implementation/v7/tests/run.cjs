const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  crypto = require("crypto");
const ROOT = path.resolve(__dirname, "../../.."),
  { init, db } = require("../../saltcorn/sdk.cjs"),
  C = require("../integration/contracts.cjs"),
  I = require("../integration/inbox.cjs"),
  O = require("../integration/outcomes.cjs"),
  W = require("../integration/worker.cjs"),
  { createRelay } = require("./relay-emulator.cjs");
const { chromium } = require("playwright");
const accounts = JSON.parse(
  fs.readFileSync(ROOT + "/private/saltcorn-accounts.json"),
);
const results = [],
  stamp = Date.now(),
  evidence = ROOT + "/evidence/v7";
fs.mkdirSync(evidence, { recursive: true });
const configFile = ROOT + "/private/v7-integration.json",
  original = fs.readFileSync(configFile),
  config = JSON.parse(original);
let relay, browser;
const pages = {};
async function check(
  name,
  fn,
  kind = "Local Saltcorn/PostgreSQL/Flowable test; one-person role simulation",
) {
  try {
    const detail = await fn();
    results.push({ test: name, status: "Pass", kind, detail });
    console.log("PASS " + name);
  } catch (e) {
    results.push({ test: name, status: "Fail", kind, error: e.message });
    throw e;
  }
}
async function session(role) {
  if (pages[role]) return pages[role];
  const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    p = await ctx.newPage(),
    a = accounts.find((x) => x.key === role);
  await p.goto((require("../../v8/runtime.cjs").APP_URL+'/auth/login'));
  await p.locator("[name=email]").fill(a.email);
  await p.locator("[name=password]").fill(a.password);
  await p.locator("button[type=submit],input[type=submit]").first().click();
  await p.waitForTimeout(150);
  pages[role] = p;
  return p;
}
async function inboxPage(role) {
  const p = await session(role);
  await p.goto((require("../../v8/runtime.cjs").APP_URL+'/page/support-inbox'));
  return p;
}
async function post(p, data, view = "V7_inbox") {
  return p.evaluate(
    async ({ data, view }) => {
      const token = document.querySelector("input[name=_csrf]")?.value;
      if (!token) throw Error("No native CSRF form on page");
      const r = await fetch("/view/" + view, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ ...data, _csrf: token }),
      });
      return { status: r.status, body: await r.json() };
    },
    { data, view },
  );
}
async function zap(operation, payload) {
  const envelope = C.signEnvelope(
    "zapier",
    operation,
    payload,
    config.relay_zapier_secret,
  );
  return (
    await fetch(relay.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    })
  ).json();
}
const row = async (id) =>
  (await db.query("SELECT * FROM support_inbox WHERE id=$1", [id])).rows[0];
const user = (key) => accounts.find((a) => a.key === key);
(async () => {
  await init();
  const finances = (await db.query("SELECT * FROM transactions ORDER BY id"))
    .rows;
  const accountSnapshot = (await db.query("SELECT * FROM accounts ORDER BY id"))
    .rows;
  relay = createRelay({
    file: ROOT + "/private/relay-emulator-" + stamp + ".json",
    appSecret: config.relay_app_secret,
    zapierSecret: config.relay_zapier_secret,
  });
  await relay.start();
  process.env.V7_ALLOW_LOCAL_RELAY_TEST = "true";
  fs.writeFileSync(
    configFile,
    JSON.stringify({ ...config, enabled: true, relay_url: relay.url }),
    { mode: 0o600 },
  );
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  let draft, caseRow, out;
  const event = {
    source_type: "form",
    source_namespace: "synthetic-form-" + stamp,
    source_event_id: "synthetic-response-" + stamp,
    subject: "  Card access question  ",
    description: "  My synthetic card is locked and purchases are blocked.  ",
    submitted_at: new Date().toISOString(),
    source_reference: "",
  };
  try {
    await check(
      "Relay authentication, client scope and signed-envelope replay protection",
      async () => {
        let bad = await fetch(relay.url, {
          method: "POST",
          body: JSON.stringify({ client: "zapier" }),
        });
        assert.equal((await bad.json()).error.status, 401);
        const envelope = C.signEnvelope(
          "zapier",
          "connection.test",
          {},
          config.relay_zapier_secret,
        );
        for (let i = 0; i < 2; i++) {
          const x = await (
            await fetch(relay.url, {
              method: "POST",
              body: JSON.stringify(envelope),
            })
          ).json();
          assert.equal(
            i === 0 ? x.ok : x.error.code,
            i === 0 ? true : "REPLAYED_ENVELOPE",
          );
        }
        assert.equal((await zap("intake.poll", {})).error.status, 403);
      },
      "Local Apps Script contract emulator; no Google or Zapier execution",
    );
    await check(
      "Actual loopback transport outage is logged and recovers without creating a draft",
      async () => {
        await relay.stop();
        await assert.rejects(
          W.tick(),
          (e) => e.code === "RELAY_NETWORK_FAILURE" && e.retryable,
        );
        await W.monitoredTick();
        const monitor = JSON.parse(
          fs.readFileSync(ROOT + "/private/v7-transport-state.json"),
        );
        assert.equal(monitor.state, "RETRY_PENDING");
        assert.equal(monitor.error_code, "RELAY_NETWORK_FAILURE");
        await relay.start();
        fs.unlinkSync(ROOT + "/private/v7-transport-state.json");
        await W.monitoredTick();
        assert.equal(
          JSON.parse(fs.readFileSync(ROOT + "/private/v7-transport-state.json"))
            .state,
          "READY",
        );
      },
      "Real local HTTP connection failure; external services emulated",
    );
    await check(
      "Mapped normalized intake creates exactly one durable unverified draft",
      async () => {
        const first = await zap("intake.stage", event);
        assert.equal(first.ok, true);
        await W.tick();
        draft = (
          await db.query(
            "SELECT * FROM support_inbox WHERE source_event_id=$1",
            [event.source_event_id],
          )
        ).rows[0];
        assert.equal(draft.subject, "Card access question");
        assert.equal(draft.draft_status, "NEW");
        assert.equal(draft.support_request_id, null);
        assert.equal(draft.selected_transaction_id, null);
        assert.equal(
          new Date(draft.submitted_at).toISOString(),
          event.submitted_at,
        );
        return {
          draft_id: draft.id,
          case_id: draft.case_business_id,
          source_event_id: event.source_event_id,
        };
      },
      "Real local PostgreSQL write through app worker + emulated relay; not Zapier intake E2E",
    );
    await check(
      "Delivered Zapier action and polling functions execute their mapped contracts",
      async () => {
        const app = require("../zapier/index.js");
        class ZError extends Error {
          constructor(m, code, status) {
            super(m);
            Object.assign(this, { code, status });
          }
        }
        const z = {
          errors: { Error: ZError },
          request: async (req) => {
            const r = await fetch(relay.url, {
              method: req.method,
              headers: req.headers,
              body: req.body,
            });
            const value = await r.json();
            return {
              json: value,
              throwForStatus() {
                assert.equal(r.status, 200);
              },
            };
          },
        };
        const bundle = {
          authData: {
            relay_url:
              "https://script.google.com/macros/s/SYNTHETIC_TEST_ONLY/exec",
            relay_secret: config.relay_zapier_secret,
          },
          inputData: event,
        };
        assert.equal(
          (await app.authentication.test(z, bundle)).authenticated,
          true,
        );
        assert.equal(
          (await app.creates.stage_intake.operation.perform(z, bundle))
            .replayed,
          true,
        );
        await assert.rejects(
          app.creates.stage_intake.operation.perform(z, {
            ...bundle,
            inputData: { ...event, submitted_at: "2026-02-30T12:00:00Z" },
          }),
          (e) => e.code === "INVALID_TIMESTAMP",
        );
        assert.ok(
          Array.isArray(
            await app.triggers.outcomes.operation.perform(z, bundle),
          ),
        );
      },
      "Local Zapier source-function execution with intercepted HTTP transport; not a Zap editor or cloud run",
    );
    await check(
      "Duplicate source event is idempotent; changed payload conflicts",
      async () => {
        assert.equal((await zap("intake.stage", event)).data.replayed, true);
        assert.equal(
          (await zap("intake.stage", { ...event, subject: "Changed" })).error
            .code,
          "SOURCE_EVENT_CONFLICT",
        );
        await I.importEvent(event);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM support_inbox WHERE source_event_id=$1",
              [event.source_event_id],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await check(
      "Blank/missing required fields, invalid dates and external identity binding are rejected",
      async () => {
        for (const e of [
          { ...event, subject: " " },
          { ...event, description: "" },
          { ...event, submitted_at: "not-a-date" },
          { ...event, submitted_at: "2026-02-30T12:00:00Z" },
          { ...event, owner_id: user("requester").id },
        ]) {
          assert.equal((await zap("intake.stage", e)).ok, false);
          await assert.rejects(I.importEvent(e), (x) => x.status === 422);
        }
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM support_inbox WHERE source_event_id=$1",
              [event.source_event_id],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await check(
      "Staff assignment, cross-user isolation and requester claim use native authenticated sessions",
      async () => {
        const staff = await inboxPage("service_agent");
        await staff
          .locator('article[data-draft-id="' + draft.id + '"]')
          .waitFor();
        let r = await post(staff, {
          command: "assign",
          id: draft.id,
          assigned_user_id: user("requester").id,
          expected_version: 1,
        });
        assert.equal(r.status, 200);
        let foreign = await inboxPage("other_requester");
        assert.equal(
          await foreign
            .locator('article[data-draft-id="' + draft.id + '"]')
            .count(),
          0,
        );
        await assert.rejects(
          I.claim(user("other_requester"), draft.id, 2),
          (x) => x.status === 403,
        );
        await assert.rejects(
          I.assign(user("requester"), draft.id, user("requester").id, 2),
          (x) => x.status === 403,
        );
        const p = await inboxPage("requester");
        assert.equal(
          (
            await post(p, {
              command: "claim",
              id: draft.id,
              expected_version: 2,
            })
          ).status,
          200,
        );
        await p.reload();
        assert.match(
          await p
            .locator('article[data-draft-id="' + draft.id + '"]')
            .innerText(),
          /CLAIMED/,
        );
        await p.screenshot({ path: evidence + "/01-inbox-claimed.png" });
      },
    );
    await check(
      "Only own transaction can be bound; a stale draft version is rejected",
      async () => {
        const tx = (
          await db.query(
            "SELECT id FROM transactions WHERE owner_id=$1 LIMIT 1",
            [user("other_requester").id],
          )
        ).rows[0].id;
        const p = await inboxPage("requester");
        assert.equal(
          (
            await post(p, {
              command: "submit_draft",
              id: draft.id,
              expected_version: 3,
              transaction_id: tx,
              description: event.description.trim(),
            })
          ).status,
          403,
        );
        await assert.rejects(
          I.submit(user("requester"), {
            id: draft.id,
            expected_version: 1,
            transaction_id: tx,
            description: "Synthetic request",
          }),
          (e) => e.status === 409,
        );
        assert.equal((await row(draft.id)).support_request_id, null);
      },
    );
    await check(
      "Claimed draft submits to original Flowable and actual runtime classifier",
      async () => {
        const tx = (
            await db.query(
              "SELECT id FROM transactions WHERE owner_id=$1 ORDER BY id LIMIT 1",
              [user("requester").id],
            )
          ).rows[0].id,
          p = await inboxPage("requester");
        const r = await post(p, {
          command: "submit_draft",
          id: draft.id,
          expected_version: 3,
          transaction_id: tx,
          description: event.description.trim(),
        });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        draft = await row(draft.id);
        assert.equal(draft.draft_status, "SUBMITTED");
        caseRow = (
          await db.query("SELECT * FROM support_requests WHERE id=$1", [
            draft.support_request_id,
          ])
        ).rows[0];
        assert.equal(caseRow.state, "SERVICE_REVIEW");
        assert.equal(caseRow.ai_category, "card_access");
        const again = await I.submit(user("requester"), {
          id: draft.id,
          expected_version: 3,
          transaction_id: tx,
          description: event.description.trim(),
        });
        assert.equal(again.support_request_id, draft.support_request_id);
        return {
          case_id: caseRow.business_id,
          process_instance_id: caseRow.process_instance_id,
          ai_category: caseRow.ai_category,
        };
      },
    );
    await check("Nonterminal records cannot publish outcomes", async () => {
      await O.captureTerminals();
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM v7_outbox WHERE case_id=$1",
            [caseRow.business_id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await zap("outcome.publish", {
            delivery_id: "test",
            case_id: caseRow.business_id,
            state_version: 1,
            final_state: "SERVICE_REVIEW",
            case_processed_at: new Date().toISOString(),
          })
        ).error.status,
        403,
      );
      assert.throws(
        () =>
          C.normalizeOutcome({
            delivery_id: "test",
            case_id: caseRow.business_id,
            state_version: 1,
            final_state: "SERVICE_REVIEW",
            case_processed_at: new Date().toISOString(),
          }),
        (e) => e.code === "NON_TERMINAL_STATE",
      );
    });
    await check(
      "Service-agent to reviewer handoff and terminal write-back survive browser refresh",
      async () => {
        for (const [role, decision] of [
          ["service_agent", "continue"],
          ["reviewer", "complete"],
        ]) {
          const p = await session(role);
          await p.goto((require("../../v8/runtime.cjs").APP_URL+'/page/support-requests'));
          const a = p.locator(
            'article[data-business-id="' + caseRow.business_id + '"]',
          );
          await a
            .locator("[name=comment]")
            .fill(
              "Synthetic V7 " + role + " review; no financial data change.",
            );
          await a.locator("[name=decision]").selectOption(decision);
          await a.getByRole("button", { name: "Save decision" }).click();
          await p.waitForURL("**/page/support-requests");
        }
        const p = await session("requester");
        await p.goto((require("../../v8/runtime.cjs").APP_URL+'/page/support-requests'));
        await p.reload();
        assert.match(
          await p
            .locator('article[data-business-id="' + caseRow.business_id + '"]')
            .innerText(),
          /COMPLETED/,
        );
        await p.screenshot({ path: evidence + "/02-flowable-completed.png" });
        caseRow = (
          await db.query("SELECT * FROM support_requests WHERE id=$1", [
            caseRow.id,
          ])
        ).rows[0];
        return {
          case_id: caseRow.business_id,
          state: caseRow.state,
          sequence: caseRow.sequence,
        };
      },
    );
    await check(
      "Persisted terminal outcome publishes a minimal durable event only once",
      async () => {
        await W.tick();
        out = (
          await db.query("SELECT * FROM v7_outbox WHERE case_id=$1", [
            caseRow.business_id,
          ])
        ).rows[0];
        assert.equal(out.job_status, "WAITING_ZAPIER");
        await O.captureTerminals();
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM v7_outbox WHERE case_id=$1",
              [caseRow.business_id],
            )
          ).rows[0].n,
          1,
        );
        const poll = await zap("outcome.poll", {});
        assert.ok(
          poll.data.items.some((i) => i.delivery_id === out.delivery_id),
        );
        assert.deepEqual(
          Object.keys(O.payload(out)).sort(),
          [
            "delivery_id",
            "case_id",
            "state_version",
            "final_state",
            "case_processed_at",
          ].sort(),
        );
      },
    );
    await check(
      "External write failure is visible while business state remains completed",
      async () => {
        relay.failOnce();
        const failed = await zap("outcome.apply", O.payload(out));
        assert.equal(failed.ok, false);
        assert.equal(failed.error.code, "EXTERNAL_WRITE_FAILED");
        await W.tick();
        const s = (
          await db.query("SELECT * FROM v7_case_sync WHERE case_id=$1", [
            caseRow.business_id,
          ])
        ).rows[0];
        assert.equal(s.sync_status, "FAILED");
        assert.equal(
          (
            await db.query("SELECT state FROM support_requests WHERE id=$1", [
              caseRow.id,
            ])
          ).rows[0].state,
          "COMPLETED",
        );
        const p = await session("service_agent");
        await p.goto((require("../../v8/runtime.cjs").APP_URL+'/page/case-synchronization'));
        await p.screenshot({ path: evidence + "/03-sync-failure.png" });
        return {
          case_id: caseRow.business_id,
          business_state: "COMPLETED",
          sync_status: s.sync_status,
          error_code: s.error_code,
        };
      },
      "Real local app + delivered Apps Script running on emulated Google storage; not external failure proof",
    );
    await check(
      "Authorized replay recovers with one external row and durable synchronization receipt",
      async () => {
        await assert.rejects(O.replay(user("service_agent"),"invalid"),e=>e.status===422);
        await assert.rejects(
          O.replay(user("requester"), out.id),
          (e) => e.status === 403,
        );
        await O.replay(user("service_agent"), out.id);
        await W.tick();
        out = (await db.query("SELECT * FROM v7_outbox WHERE id=$1", [out.id]))
          .rows[0];
        assert.ok(out.delivery_id.endsWith(":r1"));
        const ok = await zap("outcome.apply", O.payload(out));
        assert.equal(ok.data.result, "SYNCED");
        assert.equal(
          (await zap("outcome.apply", O.payload(out))).data.result,
          "SYNCED",
        );
        await W.tick();
        await assert.rejects(
          O.receipt({
            ...ok.data,
            receipt_id: "late-" + stamp,
            result: "FAILED",
            error_code: "EXTERNAL_WRITE_FAILED",
          }),
          (e) => e.code === "FINAL_RECEIPT_ALREADY_APPLIED",
        );
        const s = (
          await db.query("SELECT * FROM v7_case_sync WHERE case_id=$1", [
            caseRow.business_id,
          ])
        ).rows[0];
        assert.equal(s.sync_status, "SYNCED");
        assert.equal(
          relay
            .snapshot()
            .sheets.ExternalCases.filter((r) => r[0] === caseRow.business_id)
            .length,
          1,
        );
        const p = await session("requester");
        await p.goto((require("../../v8/runtime.cjs").APP_URL+'/page/case-synchronization'));
        await p.reload();
        assert.equal(
          await p
            .locator(
              'article[data-case-id="' + caseRow.business_id + '"] .sync-state',
            )
            .innerText(),
          "SYNCED",
        );
        await p.screenshot({ path: evidence + "/04-sync-recovered-local.png" });
        return {
          case_id: s.case_id,
          state_version: s.state_version,
          synced_at: s.synced_at,
          external_record_id: s.external_record_id,
          external_system: "LOCAL CONTRACT EMULATOR, not Google Sheets",
        };
      },
    );
    await check(
      "Stale events cannot overwrite a newer external row; mismatched receipts rejected",
      async () => {
        const p = {
          ...O.payload(out),
          delivery_id: out.event_id + ":stale",
          state_version: out.state_version - 1,
        };
        const publish = C.signEnvelope(
          "app",
          "outcome.publish",
          p,
          config.relay_app_secret,
        );
        assert.equal(
          (
            await (
              await fetch(relay.url, {
                method: "POST",
                body: JSON.stringify(publish),
              })
            ).json()
          ).ok,
          true,
        );
        assert.equal(
          (await zap("outcome.apply", p)).data.result,
          "STALE_IGNORED",
        );
        assert.equal(
          Number(
            relay
              .snapshot()
              .sheets.ExternalCases.find(
                (r) => r[0] === caseRow.business_id,
              )[2],
          ),
          out.state_version,
        );
        await assert.rejects(
          O.receipt({
            receipt_id: "wrong",
            delivery_id: out.delivery_id,
            case_id: caseRow.business_id,
            state_version: 999,
            result: "SYNCED",
          }),
          (e) => e.code === "RECEIPT_CORRELATION_MISMATCH",
        );
      },
    );
    await check(
      "Only recoverable transport errors schedule retries",
      async () => {
        const core=require('../../saltcorn/integration.cjs');
        const tx=(await db.query('SELECT id FROM transactions WHERE owner_id=$1 LIMIT 1',[user('requester').id])).rows[0].id;
        let rejected=await core.submit(user('requester'),{business_id:'v6-'+crypto.randomUUID(),transaction_id:tx,description:'Synthetic support request for retry policy validation'});
        await core.decide(user('service_agent'),{id:rejected.id,expected_sequence:rejected.sequence,decision:'reject',comment:'Synthetic rejection path; no financial decision.'});
        rejected=(await db.query('SELECT * FROM support_requests WHERE id=$1',[rejected.id])).rows[0];
        assert.equal(rejected.state,'REJECTED');await O.captureTerminals();
        const other=(await db.query('SELECT * FROM v7_outbox WHERE case_id=$1',[rejected.business_id])).rows[0];
        await O.failed(
          other,
          new C.IntegrationError(
            503,
            "NETWORK_FAILURE",
            "Synthetic failure",
            true,
          ),
        );
        assert.equal(
          (
            await db.query("SELECT job_status FROM v7_outbox WHERE id=$1", [
              other.id,
            ])
          ).rows[0].job_status,
          "RETRY_PENDING",
        );
        await O.failed(
          other,
          new C.IntegrationError(
            401,
            "AUTH_FAILED",
            "Synthetic failure",
            false,
          ),
        );
        assert.equal(
          (
            await db.query("SELECT job_status FROM v7_outbox WHERE id=$1", [
              other.id,
            ])
          ).rows[0].job_status,
          "FAILED",
        );
      },
    );
    await check(
      "Original transaction and account/balance records remain unchanged",
      async () => {
        assert.deepEqual(
          (await db.query("SELECT * FROM transactions ORDER BY id")).rows,
          finances,
        );
        assert.deepEqual(
          (await db.query("SELECT * FROM accounts ORDER BY id")).rows,
          accountSnapshot,
        );
      },
    );
  } catch (e) {
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(configFile, original, { mode: 0o600 });
    delete process.env.V7_ALLOW_LOCAL_RELAY_TEST;
    if (browser) await browser.close();
    if (relay) await relay.stop();
    await db.close();
    fs.writeFileSync(
      evidence + "/results.json",
      JSON.stringify(
        {
          time: new Date().toISOString(),
          kind: "Local actual Saltcorn + PostgreSQL + Flowable + classifier; relay executes delivered Apps Script with emulated Google services. No real Zapier/Google E2E. One operator uses separate accounts.",
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      "Results: " +
        results.filter((x) => x.status === "Pass").length +
        " Pass, " +
        results.filter((x) => x.status === "Fail").length +
        " Fail",
    );
  }
})().catch((e) => {
  fs.writeFileSync(configFile, original, { mode: 0o600 });
  console.error(e.message);
  process.exitCode = 1;
});

const fs = require("fs"),
  path = require("path"),
  { db } = require("../saltcorn/sdk.cjs"),
  I = require("./integration/inbox.cjs"),
  O = require("./integration/outcomes.cjs"),
  C = require("./integration/contracts.cjs");
const ROOT = path.resolve(__dirname, "../..");
const e = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function form(name, req, command, fields, button) {
  return `<form method="post" action="/view/${e(name)}"><input type="hidden" name="_csrf" value="${e(req.csrfToken())}"><input type="hidden" name="command" value="${command}">${fields}<button class="btn btn-primary my-2" type="submit">${button}</button></form>`;
}
const hidden = (n, v) => `<input type="hidden" name="${n}" value="${e(v)}">`;
const template = {
  name: "Hikyu V7 Integrations",
  tableless: true,
  display_state_form: false,
  get_state_fields: async () => [],
  configuration_workflow: () => null,
  run: async (t, name, c, state, { req }) => {
    const a = I.actor(req.user),
      staff = I.isStaff(a);
    let html =
      '<nav><a href="/page/support-inbox">Support Inbox</a> · <a href="/page/support-requests">Transaction Support Review</a> · <a href="/page/case-synchronization">Outcome Synchronization</a></nav>';
    const transport = require("./integration/relay-client.cjs").configuration();
    if (
      /^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(transport.relay_url || "")
    )
      html +=
        '<p class="alert alert-warning">Local contract emulator configured. This is not a Zapier or Google Sheets end-to-end run.</p>';
    if (c.mode === "inbox") {
      html +=
        "<h1>Support Inbox</h1><p>External requests are unverified drafts. A sender address or external transaction reference never proves ownership.</p>";
      const targets = JSON.parse(
        fs.readFileSync(ROOT + "/private/saltcorn-accounts.json"),
      ).filter((x) => ["requester", "other_requester"].includes(x.key));
      const tx = (
        await db.query(
          "SELECT id,name FROM transactions WHERE owner_id=$1 ORDER BY id",
          [a.id],
        )
      ).rows;
      const rows = await I.visible(req.user);
      for (const r of rows) {
        html += `<article class="v6-panel v7-draft" data-draft-id="${r.id}"><h2>${e(r.subject)}</h2><p>${e(r.description)}</p><p>Source event: ${e(r.source_event_id)} · Source: ${e(r.source_type)} · Submitted: ${e(r.submitted_at)}</p><p>Draft status: <strong>${e(r.draft_status)}</strong> · Version: ${r.draft_version}</p><p>Case number: ${e(r.case_business_id)}</p>`;
        const identity =
          hidden("id", r.id) + hidden("expected_version", r.draft_version);
        if (staff && ["NEW", "ASSIGNED"].includes(r.draft_status))
          html += form(
            name,
            req,
            "assign",
            identity +
              `<label>Assign to<select name="assigned_user_id" class="form-control">${targets.map((u) => `<option value="${u.id}">${e(u.key)}</option>`).join("")}</select></label>`,
            "Assign draft",
          );
        if (
          I.isRequester(a) &&
          r.assigned_user_id === a.id &&
          r.draft_status === "ASSIGNED"
        )
          html += form(name, req, "claim", identity, "Claim assigned draft");
        if (
          I.isRequester(a) &&
          r.claimed_by === a.id &&
          ["CLAIMED", "SUBMISSION_FAILED"].includes(r.draft_status)
        )
          html += form(
            name,
            req,
            "submit_draft",
            identity +
              `<label>Your transaction<select name="transaction_id" class="form-control" required>${tx.map((x) => `<option value="${x.id}" ${r.selected_transaction_id === x.id ? "selected" : ""}>${e(x.name)}</option>`).join("")}</select></label><label>Confirmed description<textarea name="description" class="form-control" minlength="3" maxlength="2000" required>${e(r.confirmed_description || r.description)}</textarea></label><p>Confirm that this is your own transaction. Submission starts the existing Flowable review.</p>`,
            "Confirm ownership and submit",
          );
        if (r.draft_status === "SUBMITTED")
          html +=
            "<p>Submitted to Transaction Support Review. Follow the existing workflow page for business processing.</p>";
        if (r.error_code) html += `<p role="alert">${e(r.error_code)}</p>`;
        html += "</article>";
      }
      if (!rows.length)
        html += "<p>No drafts are assigned to your account.</p>";
    } else {
      html +=
        "<h1>Support Case Outcome Synchronization</h1><p>Business status and external synchronization status are separate. Only persisted terminal records enter this queue.</p>";
      const rows = await O.visible(req.user);
      for (const r of rows) {
        html += `<article class="v6-panel v7-sync" data-case-id="${e(r.case_id)}"><h2>${e(r.case_id)}</h2><p>Business state: <strong>${e(r.business_state)}</strong> · Version ${r.state_version}</p><p>External synchronization: <strong class="sync-state">${e(r.sync_status)}</strong></p><p>Last attempt: ${e(r.last_attempt_at || "Not attempted")} · Synchronized: ${e(r.synced_at || "Not confirmed")}</p><p>External record: ${e(r.external_record_id || "Not available")} · Error: ${e(r.error_code || "None")}</p>`;
        if (staff && !["ACKNOWLEDGED", "OBSOLETE"].includes(r.job_status))
          html += form(
            name,
            req,
            "replay",
            hidden("id", r.outbox_id),
            "Replay outcome safely",
          );
        html += "</article>";
      }
      if (!rows.length)
        html += "<p>No terminal support outcomes are queued.</p>";
      if (staff) {
        let monitor = { state: "Not checked" };
        try {
          monitor = JSON.parse(
            fs.readFileSync(ROOT + "/private/v7-transport-state.json"),
          );
        } catch {}
        html += `<h2>Relay transport</h2><p>State: ${e(monitor.state)} · Error: ${e(monitor.error_code || "None")} · Checked: ${e(monitor.checked_at || "Not checked")}</p>`;
        const stats = (
          await db.query(
            "SELECT job_status,count(*)::int total FROM v7_outbox GROUP BY job_status ORDER BY job_status",
          )
        ).rows;
        html +=
          "<h2>Integration monitor</h2>" +
          stats.map((x) => `<p>${e(x.job_status)}: ${x.total}</p>`).join("");
        const events = (
          await db.query(
            "SELECT correlation_id,event_kind,result_code,occurred_at FROM v7_audit ORDER BY id DESC LIMIT 25",
          )
        ).rows;
        html +=
          '<h2>Recent correlation events</h2><table class="table"><tr><th>Correlation</th><th>Operation</th><th>Result</th><th>Time</th></tr>' +
          events
            .map(
              (x) =>
                `<tr><td>${e(x.correlation_id)}</td><td>${e(x.event_kind)}</td><td>${e(x.result_code)}</td><td>${e(x.occurred_at)}</td></tr>`,
            )
            .join("") +
          "</table>";
      }
    }
    return html;
  },
  runPost: async (t, name, c, state, b, { req, res }) => {
    try {
      let result;
      if (b.command === "assign")
        result = await I.assign(
          req.user,
          b.id,
          b.assigned_user_id,
          b.expected_version,
        );
      else if (b.command === "claim")
        result = await I.claim(req.user, b.id, b.expected_version);
      else if (b.command === "submit_draft")
        result = await I.submit(req.user, b);
      else if (b.command === "replay") result = await O.replay(req.user, b.id);
      else
        throw new C.IntegrationError(400, "UNKNOWN_COMMAND", "Unknown command");
      const publicResult = {
        id: result.id,
        draft_status: result.draft_status,
        draft_version: result.draft_version,
        case_id: result.case_business_id || result.case_id,
        support_request_id: result.support_request_id,
        job_status: result.job_status,
      };
      if (req.get("Accept") === "application/json")
        res.json({ ok: true, result: publicResult });
      else
        res.redirect(
          303,
          c.mode === "inbox"
            ? "/page/support-inbox"
            : "/page/case-synchronization",
        );
    } catch (err) {
      res
        .status(err.status || (err.code && Number(err.code)) || 500)
        .json({
          ok: false,
          error: {
            code:
              typeof err.code === "string"
                ? err.code
                : "INTEGRATION_OPERATION_FAILED",
            message: err.status ? err.message : "Integration operation failed",
          },
        });
    }
  },
};
module.exports = { template };

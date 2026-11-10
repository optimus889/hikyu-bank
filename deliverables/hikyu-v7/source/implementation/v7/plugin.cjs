const fs = require("fs"),
  path = require("path"),
  { db } = require("../saltcorn/sdk.cjs"),
  I = require("./integration/inbox.cjs"),
  O = require("./integration/outcomes.cjs"),
  C = require("./integration/contracts.cjs");
const ROOT = path.resolve(__dirname, "../..");
const template = {
  name: "Hikyu V7 Integrations",
  tableless: true,
  display_state_form: false,
  get_state_fields: async () => [],
  configuration_workflow: () => null,
  run: async (t, name, c, state, {req}) => {
    const a=I.actor(req.user),staff=I.isStaff(a);
    const UI=require('../v8/ui/common.cjs');
    if(c.mode==='inbox'){
      const targets=JSON.parse(fs.readFileSync(ROOT+'/private/saltcorn-accounts.json')).filter(x=>['requester','other_requester'].includes(x.key));
      const transactions=(await db.query('SELECT id,name FROM transactions WHERE owner_id=$1 ORDER BY id',[a.id])).rows;
      return UI.shell('inbox',require('../v8/ui/inbox.cjs').render({name,req,actor:a,staff,requester:I.isRequester(a),targets,transactions,rows:await I.visible(req.user)}));
    }
    const transport=require('./integration/relay-client.cjs').configuration();let monitor={state:'Not checked'},stats=[],events=[];
    if(staff){
      try{monitor=JSON.parse(fs.readFileSync(ROOT+'/private/v7-transport-state.json'));}catch{}
      stats=(await db.query('SELECT job_status,count(*)::int total FROM v7_outbox GROUP BY job_status ORDER BY job_status')).rows;
      events=(await db.query('SELECT correlation_id,event_kind,result_code,occurred_at FROM v7_audit ORDER BY id DESC LIMIT 25')).rows;
    }
    return UI.shell('sync',require('../v8/ui/monitor.cjs').render({name,req,staff,rows:await O.visible(req.user),transport,monitor,stats,events}));
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

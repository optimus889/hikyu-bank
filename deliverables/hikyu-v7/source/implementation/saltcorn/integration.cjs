const fs=require('fs'),crypto=require('crypto');const {db,Table}=require('./sdk.cjs');
const ROOT=require("path").resolve(__dirname, '../..');
const STAGES={manualTriage:'MANUAL_TRIAGE',agentReview:'SERVICE_REVIEW',requesterCorrection:'RETURNED',reviewerReview:'REVIEWER_REVIEW',supervisorReview:'ESCALATED',completed:'COMPLETED',rejected:'REJECTED'};
const ROLES={manualTriage:'service_agent',agentReview:'service_agent',requesterCorrection:'requester',reviewerReview:'reviewer',supervisorReview:'supervisor',completed:'none',rejected:'none'};
class Failure extends Error{constructor(code,msg){super(msg);this.code=code;}}
function actor(user){if(!user?.id)throw new Failure(401,'Please sign in.');const a=JSON.parse(fs.readFileSync(ROOT+'/private/saltcorn-accounts.json')).find(a=>a.id===user.id);if(!a)throw new Failure(403,'No workflow role is assigned.');return a;}
function token(id){const r=JSON.parse(fs.readFileSync(ROOT+'/private/roles.json')).find(r=>r.id===id);if(!r)throw new Failure(403,'Workflow identity is not configured.');return r.token;}
async function wf(path,data,identity='connector.local'){
 let r;try{r=await fetch((process.env.HIKYU_WORKFLOW_URL||'http://127.0.0.1:8196')+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token(identity),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});}catch{throw new Failure(503,'Workflow connection unavailable; retry is scheduled.');}
 const out=await r.json();if(!r.ok)throw new Failure(r.status,out.error||'Workflow request failed.');return out;
}
async function apply(id,s){
 if(!STAGES[s.stage]||!Number.isSafeInteger(s.sequence))throw new Failure(502,'Invalid workflow status.');
 const r=await db.query('SELECT * FROM support_requests WHERE id=$1',[id]);const old=r.rows[0];if(!old||old.business_id!==s.business_id)throw new Failure(409,'Business correlation mismatch.');
 if(old.process_instance_id&&old.process_instance_id!==s.process_instance_id)throw new Failure(409,'Process correlation mismatch.');
 if(['COMPLETED','REJECTED'].includes(old.state)&&old.state!==STAGES[s.stage])throw new Failure(409,'Final status cannot be overwritten.');
 if(old.sequence>=s.sequence)return false;
 let ai={};try{ai=JSON.parse(s.ai_result||'{}');}catch{throw new Failure(502,'Invalid AI projection.');}
 await db.query("UPDATE support_requests SET process_instance_id=$1,state=$2,sequence=$3,ai_category=$4,ai_confidence=$5,ai_model_version=$6,\"current_role\"=$7,updated_at=$8,outcome=$9,last_comment=$10,integration_error=NULL WHERE id=$11 AND COALESCE(sequence,0)<$3",[s.process_instance_id,STAGES[s.stage],s.sequence,ai.category||'manual_required',String(ai.confidence??''),ai.model_version||'',ROLES[s.stage],s.updated_at, ['completed','rejected'].includes(s.stage)?s.stage:'',s.last_comment||'',id]);return true;
}
async function syncRow(row){
 try{
  const s=row.process_instance_id?await wf('/requests/'+encodeURIComponent(row.process_instance_id)):await wf('/requests',{business_id:row.business_id,description:row.description,requester_id:'sc-user-'+row.owner_id});
  await apply(row.id,s);await db.query('UPDATE support_requests SET retry_attempts=0,next_retry_at=NULL,integration_error=NULL WHERE id=$1',[row.id]);return s;
 }catch(e){const count=(row.retry_attempts||0)+1;await db.query('UPDATE support_requests SET retry_attempts=$1,next_retry_at=$2,integration_error=$3 WHERE id=$4',[count,new Date(Date.now()+Math.min(60000,1000*2**Math.min(count,6))),'Workflow synchronization pending',row.id]);throw e;}
}
async function submit(user,b){
 const a=actor(user);if(!['requester','other_requester'].includes(a.key))throw new Failure(403,'Requester role required.');
 const description=String(b.description||'').trim();if(description.length<3||description.length>2000)throw new Failure(400,'Description must contain 3–2000 characters.');
 const transaction=Number(b.transaction_id);if(!Number.isSafeInteger(transaction)||transaction<1)throw new Failure(400,'Choose a valid transaction.');
 const t=await db.query('SELECT id FROM transactions WHERE id=$1 AND owner_id=$2',[transaction,user.id]);if(!t.rows.length)throw new Failure(403,'The transaction does not belong to you.');
 const bid=String(b.business_id||'');if(!/^v6-[a-f0-9-]{36}$/.test(bid))throw new Failure(400,'Invalid request key.');
 const hash=crypto.createHash('sha256').update(JSON.stringify([user.id,transaction,description])).digest('hex');
 let r=await db.query('SELECT * FROM support_requests WHERE business_id=$1',[bid]);let row=r.rows[0];
 if(row){if(row.owner_id!==user.id||row.request_hash!==hash)throw new Failure(409,'Request key was reused with different content.');}
 else{
  try{r=await db.query("INSERT INTO support_requests(owner_id,business_id,transaction_id,description,state,sequence,\"current_role\",created_at,updated_at,request_hash,retry_attempts) VALUES($1,$2,$3,$4,'SUBMITTED',0,'integration',$5,$5,$6,0) RETURNING *",[user.id,bid,transaction,description,new Date(),hash]);row=r.rows[0];}
  catch(e){if(e.code!=='23505')throw new Failure(500,'Business record creation failed.');r=await db.query('SELECT * FROM support_requests WHERE business_id=$1',[bid]);row=r.rows[0];if(!row||row.owner_id!==user.id||row.request_hash!==hash)throw new Failure(409,'Concurrent submission conflict.');}
 }
 try{await syncRow(row);}catch(e){if(e.code&&e.code<500)throw e;}
 return (await db.query('SELECT * FROM support_requests WHERE id=$1',[row.id])).rows[0];
}
async function decide(user,b){
 const a=actor(user);const id=Number(b.id);const rows=(await db.query('SELECT * FROM support_requests WHERE id=$1',[id])).rows;const row=rows[0];if(!row)throw new Failure(404,'Request not found.');
 const role=a.key==='other_requester'?'requester':a.key;
 if(row.current_role!==role||role==='requester'&&row.owner_id!==user.id)throw new Failure(403,'This task is not assigned to your role.');
 if(Number(b.expected_sequence)!==row.sequence)throw new Failure(409,'The task has changed. Refresh before deciding.');
 const comment=String(b.comment||'').trim();if(!comment||comment.length>2000)throw new Failure(400,'A processing comment is required.');
 const payload={expected_sequence:row.sequence,decision:String(b.decision||''),comment};
 if(role==='requester')payload.description=String(b.description||'').trim();
 const s=await wf('/requests/'+encodeURIComponent(row.process_instance_id)+'/decision',payload,'sc-user-'+user.id);
 try{await apply(row.id,s);}catch(e){await db.query("UPDATE support_requests SET integration_error='Workflow synchronization pending',next_retry_at=$1 WHERE id=$2",[new Date(),row.id]);throw new Failure(503,'Decision committed; status synchronization will retry.');}
 if(role==='requester')await db.query('UPDATE support_requests SET description=$1 WHERE id=$2',[payload.description,row.id]);return s;
}
async function visibleRows(user){const a=actor(user);if(['requester','other_requester'].includes(a.key))return (await db.query('SELECT * FROM support_requests WHERE owner_id=$1 ORDER BY id DESC',[user.id])).rows;return (await db.query('SELECT * FROM support_requests WHERE \"current_role\"=$1 ORDER BY id',[a.key])).rows;}
module.exports={Failure,actor,wf,apply,syncRow,submit,decide,visibleRows,STAGES,ROLES};

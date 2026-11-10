const {init,db,Table,Field,User,View,Page}=require('./sdk.cjs'),fs=require('fs'),crypto=require('crypto'),bank=require('./banking.cjs');
(async()=>{await init();const t=Table.findOne('payment_verifications');if(!t.getFields().some(f=>f.name==='created_at'))await Field.create({table_id:t.id,name:'created_at',label:'Created at',type:'Date',attributes:{min_role_read:1,min_role_write:1}});
const p=require("path").resolve(__dirname, '../..', 'private/saltcorn-pins.json');let pins=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{};
for(const u of JSON.parse(fs.readFileSync(require("path").resolve(__dirname, '../..', 'private/saltcorn-accounts.json'))).filter(u=>['requester','other_requester'].includes(u.key))){if(!pins[u.key])pins[u.key]=String(crypto.randomInt(0,10000)).padStart(4,'0');await db.query('UPDATE user_profiles SET pin_hash=$1 WHERE owner_id=$2',[bank.pinHash(pins[u.key]),u.id]);if(!(await db.query('SELECT id FROM user_preferences WHERE owner_id=$1',[u.id])).rows.length)await db.query('INSERT INTO user_preferences(owner_id,low_balance_enabled,large_transfer_enabled) VALUES($1,true,true)',[u.id]);}
fs.writeFileSync(p,JSON.stringify(pins,null,2),{mode:0o600});
const queries=[
'CREATE UNIQUE INDEX IF NOT EXISTS v6_one_deposit_type ON accounts(owner_id,account_type) WHERE account_type IN (\'checking\',\'savings\') AND status IN (\'active\',\'pending\')',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_op_idempotency ON financial_operations(owner_id,idempotency_key)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_unique_budget ON budgets(owner_id,month,category)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_unique_payee ON saved_payees(owner_id,kind,identifier)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_unique_card ON card_controls(account_id)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_unique_event ON alert_events(operation_id,alert_id,event_kind)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_owner_profile ON user_profiles(owner_id)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_native_username ON user_profiles(username)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_owner_preferences ON user_preferences(owner_id)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_receipt_event ON notifications(event_key)',
'CREATE UNIQUE INDEX IF NOT EXISTS v6_unique_ledger_leg ON transactions(operation_id,account_id) WHERE operation_id IS NOT NULL',
];for(const q of queries)await db.query(q);
for(const name of ['user_profiles','payment_verifications','support_requests'])for(const f of Table.findOne(name).getFields())if(['pin_hash','code_hash','session_id','fingerprint','request_hash','retry_attempts','next_retry_at'].includes(f.name))await f.update({attributes:{...f.attributes,min_role_read:1,min_role_write:1}});
for(const name of ['card_controls','budgets','saved_payees','alerts','notifications'])for(const f of Table.findOne(name).getFields())if(!f.primary_key)await f.update({attributes:{...f.attributes,min_role_write:1}});
for(const [page,mode] of [['overview','overview'],['transactions','transactions'],['pay-transfer','pay'],['accounts-cards','accounts'],['insights','insights'],['settings','settings'],['demo-tools','purchase']]){
 const vn='V6_Banking_'+mode;if(!View.findOne({name:vn}))await View.create({name:vn,viewtemplate:'Hikyu Banking',table_id:Table.findOne('accounts').id,min_role:80,configuration:{mode}});
 const p=Page.findOne({name:page});const head=p.layout.above[0],foot=p.layout.above[p.layout.above.length-1];await Page.update(p.id,{layout:{above:[head,{type:'view',view:vn,block:true},foot]}});
}
console.log('Configured native banking views, synthetic hashed PINs and persistent invariants');await db.close();})();

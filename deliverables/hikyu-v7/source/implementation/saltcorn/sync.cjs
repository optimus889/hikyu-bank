const {init,db}=require('./sdk.cjs');const integration=require('./integration.cjs');
(async()=>{await init();let busy=false;async function once(){if(busy)return;busy=true;try{const rows=(await db.query("SELECT * FROM support_requests WHERE state NOT IN ('COMPLETED','REJECTED') AND (next_retry_at IS NULL OR next_retry_at<=now()) ORDER BY id LIMIT 50")).rows;for(const r of rows)try{await integration.syncRow(r);}catch{}}finally{busy=false;}}
await once();if(process.argv.includes('--once')){await db.close();return;}
setInterval(()=>once().catch(()=>{}),2000);console.log('V6 LCNC workflow reconciliation started; no credentials logged.');})();

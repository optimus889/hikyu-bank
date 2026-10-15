// UI integration against HTTP fixtures. Does not test browser layout or database persistence.
const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<!doctype html><html lang="en"><body><main id="app"></main></body></html>',{url:'http://localhost/#pay-transfer?tab=bill'});
 for(const k of ['document','location','FormData','Event','EventTarget'])global[k]=dom.window[k];global.window=dom.window;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 const accounts=[{id:'11111111-1111-4111-8111-111111111111',name:'Checking',type:'checking',status:'active',balance:'1000.00'}];
 const catalog=[{code:'power',name:'Demo Electric'},{code:'water',name:'Demo Water'}];
 let payees=[],failSave=false,failList=false,failDelete=false,failOperation=false,delayedSave=null,id=0;
 const calls=[];
 global.fetch=async(url,options={})=>{
  const path=new URL(url,'http://localhost').pathname.replace('/api/v1',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({path,method,body});let result=[];
  if(path==='/accounts')result=accounts;
  if(path==='/banking/catalog')result={categories:['Utilities'],billers:catalog};
  if(path==='/payees'){
   if(method==='GET'){if(failList)return new Response(JSON.stringify({message:'List refresh unavailable.'}),{status:503});result=payees;}
   else if(method==='POST'){
    if(delayedSave)await delayedSave;
    if(failSave)return new Response(JSON.stringify({message:'Biller service unavailable. Try again.'}),{status:503});
    result={...body,id:'22222222-2222-4222-8222-'+String(++id).padStart(12,'0')};payees.push(result);
   }
  }
  if(path.startsWith('/payees/')){
   const key=path.split('/').pop();
   if(method==='PATCH'){const row=payees.find(p=>p.id===key);Object.assign(row,body);result=row;}
   else if(method==='DELETE'){if(failDelete)return new Response(JSON.stringify({message:'Delete unavailable.'}),{status:503});payees=payees.filter(p=>p.id!==key);}
  }
  if(path==='/banking/verifications')result={challengeId:'challenge-1',demoCode:'123456',message:'Demo code only.'};
  if(path==='/banking/operations'&&method==='POST'){
   if(failOperation)return new Response(JSON.stringify({message:'Payment unavailable.'}),{status:503});
   result={id:'33333333-3333-4333-8333-333333333333',amount:body.amount,merchant:'Demo Electric',createdAt:'2026-10-15T02:00:00Z'};
  }
  return new Response(JSON.stringify(result),{status:200});
 };
 const {mountBanking}=await import('../js/views/banking-view.js');
 const {installEnglishValidation}=await import('../js/components/validation.js');installEnglishValidation(document);
 const root=document.querySelector('#app'),q=s=>document.querySelector(s),text=()=>root.textContent;
 const flush=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
 const click=async s=>{assert.ok(q(s),s);q(s).click();await flush();};
 const fill=(s,v)=>{assert.ok(q(s),s);q(s).value=v;q(s).dispatchEvent(new Event('input',{bubbles:true}));};
 const change=(s,v)=>{fill(s,v);q(s).dispatchEvent(new Event('change',{bubbles:true}));};
 let dispose;const mount=async()=>{dispose?.();root.innerHTML='';dispose=mountBanking(root,{tab:'bill'});await flush();};
 const posts=()=>calls.filter(c=>c.path==='/payees'&&c.method==='POST');
 const save=async()=>{q('.biller-form').requestSubmit();await flush();};
 await mount();assert.equal((text().match(/No saved billers/g)||[]).length,1);assert.ok(!q('[name=payeeId]').textContent.includes('No saved billers'));assert.equal(q('[name=payeeId]').disabled,true);assert.equal(q('.payment-panel form .primary-button').disabled,true);assert.equal(q('[data-back-bill]'),null);assert.equal(q('[data-manage-billers]'),null);assert.equal(document.querySelectorAll('[data-add-biller]').length,1);console.log('PASS one empty state, one Add action, no obsolete navigation, Review disabled');
 fill('[name=amount]','12.50');fill('[name=note]','Electric bill draft');await click('[data-add-biller]');assert.equal(q('dialog').getAttribute('aria-modal'),'true');assert.equal(document.activeElement,q('.biller-form [name=biller]'));await click('[data-cancel-biller]');assert.equal(q('dialog'),null);assert.equal(document.activeElement,q('[data-add-biller]'));assert.equal(q('[name=amount]').value,'12.50');assert.equal(q('[name=note]').value,'Electric bill draft');assert.equal(posts().length,0);console.log('PASS Cancel restores focus and preserves payment draft without a request');
 await click('[data-add-biller]');q('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));await flush();assert.equal(q('dialog'),null);assert.equal(document.activeElement,q('[data-add-biller]'));await click('[data-add-biller]');await click('dialog [data-close]');assert.equal(q('dialog'),null);console.log('PASS dialog cancel event (Escape path), close button and focus restoration');
 await click('[data-add-biller]');await save();assert.match(q('.biller-form .form-status').textContent,/Choose a biller/);assert.equal(posts().length,0);change('.biller-form [name=biller]','power');fill('.biller-form [name=reference]','   ');await save();assert.match(q('.biller-form .form-status').textContent,/Enter a demo bill reference/);assert.equal(document.activeElement,q('.biller-form [name=reference]'));assert.equal(posts().length,0);console.log('PASS missing biller and whitespace-only reference rejected in English');
 fill('.biller-form [name=reference]','x'.repeat(61));await save();assert.match(q('.biller-form .form-status').textContent,/up to 60/);assert.equal(posts().length,0);fill('.biller-form [name=reference]','demo-power-001');fill('.biller-form [name=alias]','x'.repeat(61));await save();assert.match(q('.biller-form .form-status').textContent,/at most 60/);assert.equal(posts().length,0);fill('.biller-form [name=alias]','');failSave=true;await save();assert.ok(q('dialog').open);assert.match(q('.biller-form .form-status').textContent,/Biller service unavailable/);assert.equal(q('.biller-form [type=submit]').disabled,false);assert.equal(q('.biller-form [name=reference]').value,'demo-power-001');assert.equal(payees.length,0);console.log('PASS save API failure keeps dialog, inputs and retry available');
 failSave=false;await save();assert.equal(q('dialog'),null);assert.equal(payees.length,1);assert.equal(payees[0].alias,'Demo Electric');assert.equal(q('[name=payeeId]').value,payees[0].id);assert.match(q('.biller-notice').textContent,/Biller saved and selected/);assert.ok(calls.some(c=>c.path==='/payees'&&c.method==='GET'));assert.equal(q('[name=amount]').value,'12.50');assert.equal(q('.payment-panel form .primary-button').disabled,false);assert.equal(document.activeElement,q('[data-add-biller]'));console.log('PASS save, default optional nickname, GET refresh, auto-selection, success notice and draft retention');
 for(const invalid of ['', '0','-1','1.001','1000001']){fill('[name=amount]',invalid);assert.equal(q('.payment-panel form .primary-button').disabled,true,invalid);}
 fill('[name=amount]','12.50');change('[name=payeeId]','');assert.equal(q('.payment-panel form .primary-button').disabled,true);change('[name=payeeId]',payees[0].id);assert.equal(q('.payment-panel form .primary-button').disabled,false);console.log('PASS Review tracks missing biller, positive amount, range and two-decimal precision');
 q('.payment-panel form').requestSubmit();await flush();assert.equal(q('.saved-billers').hidden,true);assert.match(text(),/Review bill pay/);fill('.finance-pin','1037');await click('[data-code]');fill('.finance-code','123456');failOperation=true;await click('[data-confirm]');assert.match(q('.finance-status').textContent,/Payment unavailable/);const first=calls.filter(c=>c.path==='/banking/operations').at(-1);failOperation=false;await click('[data-confirm]');assert.match(text(),/Completed/);assert.match(q('.receipt-id').textContent,/33333333/);const last=calls.filter(c=>c.path==='/banking/operations').at(-1);assert.equal(first.body.idempotencyKey,last.body.idempotencyKey);assert.equal(last.body.payeeId,payees[0].id);assert.equal(last.body.payeeReference,'demo-power-001');assert.equal(last.body.amount,'12.50');assert.equal(last.body.pin,'1037');assert.equal(last.body.verificationCode,'123456');console.log('PASS full Bill Pay → Add → Save → Select → Review → Confirm → receipt; payment failure retry retains request key');
 await mount();await click('[data-edit-biller]');assert.equal(q('.biller-form [name=biller]').disabled,true);fill('.biller-form [name=alias]','Home power');fill('.biller-form [name=reference]','demo-power-002');await save();assert.equal(payees[0].alias,'Home power');assert.equal(q('[name=payeeId]').value,payees[0].id);console.log('PASS existing biller edit uses PATCH and retains UUID');
 await click('[data-add-biller]');change('.biller-form [name=biller]','water');fill('.biller-form [name=reference]','demo-water-001');failList=true;const before=posts().length;await save();assert.equal(q('dialog'),null);assert.equal(posts().length,before+1);assert.equal(payees.length,2);assert.equal(q('[name=payeeId]').value,payees[1].id);assert.match(q('.biller-notice').textContent,/could not be refreshed/);failList=false;console.log('PASS successful POST with failed GET retains returned UUID and warns without a second create');
 failDelete=true;await click('[data-delete-biller]');assert.match(q('.biller-notice').textContent,/Delete unavailable/);assert.equal(payees.length,2);failDelete=false;await click('[data-delete-biller]');await click('[data-delete-biller]');assert.equal(payees.length,0);assert.equal((text().match(/No saved billers/g)||[]).length,1);assert.equal(q('.payment-panel form .primary-button').disabled,true);console.log('PASS delete API failure, successful deletion and return to a single empty state');
 await click('[data-add-biller]');change('.biller-form [name=biller]','power');fill('.biller-form [name=reference]','demo-pending');let release;delayedSave=new Promise(r=>release=r);const count=posts().length;q('.biller-form').requestSubmit();await flush();q('.biller-form').requestSubmit();q('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));await flush();assert.equal(posts().length,count+1);assert.ok(q('dialog').open);assert.equal(q('[data-cancel-biller]').disabled,true);dispose();assert.equal(q('dialog'),null);root.innerHTML='<p>Different page</p>';release();await flush();assert.equal(root.textContent,'Different page');console.log('PASS duplicate submission guard, pending-save dismissal guard and safe teardown during an in-flight save');
 dom.window.close();
})().catch(e=>{console.error(e);process.exit(1)});

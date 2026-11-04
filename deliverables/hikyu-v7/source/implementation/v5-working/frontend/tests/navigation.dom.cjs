// DOM interaction tests with HTTP fixtures; no browser layout or real database.
const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<!doctype html><html lang="en"><body><main id="app"></main></body></html>',{url:'http://localhost/#pay-transfer'});
 for(const key of ['document','location','FormData','Event','EventTarget'])global[key]=dom.window[key];
 global.window=dom.window;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 const writes=[];
 const accounts=[{id:'a1',type:'checking',name:'Everyday Checking',suffix:'1037',balance:1000,status:'active'},{id:'a2',type:'savings',name:'Everyday Saving',suffix:'2000',balance:500,status:'active'},{id:'a3',type:'credit',name:'Credit',suffix:'3000',balance:50,limit:1000,status:'active'}];
 let payees=[],budgets=[],locked=false;
 global.fetch=async (url,options={})=>{
  const path=new URL(url,'http://localhost').pathname.replace('/api/v1',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;let result=[];
  if(method!=='GET')writes.push({path,method,body});
  if(path==='/auth/session')result={expiresAt:Date.now()+3600000,user:{firstName:'Mingyu',lastName:'Fan',name:'Mingyu Fan',username:'mingyu.fan'}};
  else if(path==='/accounts')result=accounts;
  else if(path.startsWith('/accounts/'))result=accounts.find(a=>a.id===path.split('/').pop());
  else if(path==='/cards'){if(method==='GET')result=[{...accounts[0],accountId:'a1',locked,type:'debit'},{...accounts[2],accountId:'a3',locked:false}];}
  else if(path==='/cards/a1'){locked=body.locked;result={locked};}
  else if(path==='/banking/catalog')result={categories:['Shopping','Utilities'],billers:[{code:'power',name:'Demo Electric'}]};
  else if(path==='/payees') {if(method==='POST'){payees.push({...body,id:'p'+(payees.length+1)});result=payees.at(-1);}else result=payees;}
  else if(path.startsWith('/payees/')){const id=path.split('/').pop();if(method==='DELETE')payees=payees.filter(p=>p.id!==id);else Object.assign(payees.find(p=>p.id===id),body);result={};}
  else if(path==='/payments/recipient')result={username:body.username,name:'Demo Recipient',accountLabel:'Checking •••• 4000'};
  else if(path.endsWith('/verifications')||path==='/payment-verifications')result={challengeId:'challenge',demoCode:'123456',message:'Demo verification.'};
  else if(path==='/banking/operations'&&method==='POST'||['/transfers','/payments'].includes(path)&&method==='POST')result={id:'receipt-uuid',amount:body.amount,merchant:body.merchant||'Demo Electric',recipientName:'Demo Recipient',createdAt:'2026-10-15T00:00:00Z'};
  else if(path==='/budgets'){if(method==='POST'){budgets.push({...body,id:'b1',spent:0,remaining:body.limit});result=budgets.at(-1);}else result=budgets;}
  else if(path==='/budgets/b1'){if(method==='DELETE')budgets=[];else Object.assign(budgets[0],body);result={};}
  else if(path==='/transactions/search')result={items:[{id:'t1',name:'Demo shop',category:'Shopping',amount:-10,date:'2026-10-14',accountId:'a1'}],total:1};
  else if(path==='/transactions/t1')result={id:'t1',name:'Demo shop',category:'Shopping',amount:-10,date:'2026-10-14',accountId:'a1',operationId:'receipt-uuid'};
  else if(path==='/assistant/status')result={mode:'demo',description:'Demo insights.',configured:true};
  else if(path==='/assistant/messages')result={reply:'Based on your demo spending.'};
  return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
 };

 const {mountBankingSection,legacyBankingRoute}=await import('../js/views/banking-navigation.js');
 const {createAssistantView}=await import('../js/views/assistant-view.js');
 const {renderTransactionsView}=await import('../js/views/transactions-view.js');
 const {overview}=await import('../js/components/overview.js');
 const root=document.querySelector('#app'),q=s=>document.querySelector(s),all=s=>[...root.querySelectorAll(s)];
 const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
 let dispose;const go=async(hash)=>{dispose?.();location.hash='#'+hash;dispose=mountBankingSection(root,hash.split('?')[0],accounts,createAssistantView({firstName:'Mingyu',name:'Mingyu Fan'}));await flush();};
 const fill=(selector,value)=>{const el=q(selector);assert.ok(el,selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
 const click=async(selector)=>{assert.ok(q(selector),selector);q(selector).click();await flush();};
 const submit=async()=>{(q('.biller-form')||q('form')).requestSubmit();await flush();};
 const review=async(banking)=>{fill('[name=amount]','10.25');await submit();assert.ok(!q('.transfer-confirm').hidden);if(q('.finance-pin,.transfer-pin'))fill('.finance-pin,.transfer-pin','1037');await click('[data-code]');fill('.finance-code,.payment-code','123456');await click('[data-confirm]');assert.match(root.textContent,/completed/i);assert.match(root.textContent,/receipt-uuid/);};
 await go('pay-transfer');await review(false);console.log('PASS internal transfer review, verification, request and receipt');
 await go('pay-transfer?tab=payees');assert.match(root.textContent,/No saved recipients yet/);fill('[name=identifier]','demo.recipient');fill('[name=alias]','Friend');await submit();assert.match(q('.form-status').textContent,/Verify/);assert.equal(payees.length,0);
 await click('[data-verify-payee]');assert.match(q('.recipient-preview').textContent,/Demo Recipient/);await submit();assert.equal(payees[0].identifier,'demo.recipient');await click('[data-edit-payee]');fill('[name=alias]','Friend updated');await submit();assert.equal(payees[0].alias,'Friend updated');assert.match(q('.payee-list a').hash,/recipient=demo.recipient/);
 await go('pay-transfer?tab=peer&recipient=demo.recipient');assert.equal(q('[name=recipientUsername]').value,'demo.recipient');fill('[name=amount]','10.25');await submit();assert.match(q('.form-status').textContent,/Verify/);
 q('.saved-recipient').value='demo.recipient';q('.saved-recipient').dispatchEvent(new Event('change'));await click('[data-verify]');await review(false);console.log('PASS saved recipient CRUD, selection and mandatory peer verification');
 await go('pay-transfer?tab=bill');assert.match(root.textContent,/No saved billers yet. Add a biller to get started/);assert.equal(q('form .primary-button').disabled,true);await click('[data-add-biller]');fill('.biller-form [name=biller]','power');fill('[name=alias]','Home power');fill('[name=reference]','demo-001');await submit();assert.equal(payees[1].kind,'biller');assert.ok(!root.textContent.includes('Friend updated'));assert.equal(q('[name=payeeId]').value,'p2');await review(true);console.log('PASS inline biller creation, selection and bill payment');
 await go('accounts?tab=cards');await click('[data-lock=a1]');assert.equal(locked,true);await click('[data-lock=a1]');assert.equal(locked,false);assert.match(q('.banking-card-list a').hash,/account=a3/);await go('accounts?tab=repayment&account=a3');assert.equal(q('[name=targetAccountId]').value,'a3');await review(true);console.log('PASS card lock/unlock and targeted credit repayment');
 await go('accounts');assert.equal(all('[data-account]').length,3);await click('[data-account=a3]');assert.ok(document.querySelector('dialog a[href*="account=a3"][href*="repayment"]'));document.querySelector('dialog').close();console.log('PASS account balances and credit details action');
 await go('insights');fill('[name=limit]','100');await submit();assert.equal(budgets.length,1);await click('[data-edit-budget]');fill('[name=limit]','120');await submit();assert.equal(budgets[0].limit,'120');await click('[data-delete-budget]');assert.equal(budgets.length,0);assert.match(root.textContent,/No budgets for this month/);
 await go('insights?tab=assistant');fill('#message','Spending');q('#chat-form').requestSubmit();await flush();assert.match(root.textContent,/Based on your demo spending/);console.log('PASS budget CRUD and assistant integration');
 await go('demo');fill('[name=merchant]','Demo shop');await review(true);console.log('PASS simulated purchase review and receipt');
 dispose?.();dispose=renderTransactionsView(root,accounts);await flush();await click('[data-transaction]');assert.match(document.querySelector('dialog').textContent,/receipt-uuid/);document.querySelector('dialog').close();console.log('PASS transaction search, details and receipt');
 await go('pay-transfer?tab=payees');await click('[data-delete-payee]');assert.equal(payees.length,1);assert.match(root.textContent,/No saved recipients yet/);await go('pay-transfer?tab=bill');await click('[data-delete-biller]');assert.equal(payees.length,0);assert.match(root.textContent,/No saved billers yet/);console.log('PASS recipient and biller deletion');
 const tx=Array.from({length:8},(_,i)=>({name:'Merchant '+i,category:'Shopping',amount:-10,date:'2026-10-14'}));root.innerHTML=overview(accounts,{firstName:'Mingyu'},tx);assert.equal(all('.recent-overview li').length,5);assert.ok(q('a[href="#pay-transfer?tab=bill"]'));assert.equal(legacyBankingRoute('bill'),'pay-transfer?tab=bill');assert.equal(legacyBankingRoute('budgets'),'insights?tab=budgets');console.log('PASS overview five-record limit, quick actions and legacy route mapping');
 const operations=writes.filter(w=>['/banking/operations','/payments','/transfers'].includes(w.path));assert.equal(operations.length,5);for(const op of operations){assert.equal(op.body.amount,'10.25');assert.equal(op.body.verificationCode,'123456');assert.ok(op.body.idempotencyKey);}console.log('PASS 5 operation request payloads preserve decimal strings, verification and idempotency');
 dispose?.();root.innerHTML='';document.body.insertAdjacentHTML('afterbegin','<strong id="breadcrumb"></strong><a data-nav="insights"></a><a data-nav="pay-transfer"></a>');
 location.hash='#pay-transfer?tab=bill';const {startDashboard}=await import('../js/app.js');const stop=await startDashboard({firstName:'Mingyu'});await flush();assert.equal(document.querySelector('#breadcrumb').textContent,'Pay & Transfer');assert.match(root.textContent,/No saved billers yet/);location.hash='#insights?tab=assistant';await new Promise(r=>setTimeout(r,10));await flush();assert.equal(document.querySelector('#breadcrumb').textContent,'Financial Insights');assert.ok(q('#chat-form'));stop();console.log('PASS dashboard routing, hash changes and navigation state');
 dom.window.close();
})().catch(e=>{console.error(e);process.exit(1)});

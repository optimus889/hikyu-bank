// Browser regression with deterministic HTTP fixtures. This does not test a real database.
// Run with Playwright available: node frontend/tests/navigation.browser.cjs
// Serve frontend at http://127.0.0.1:8765 first (or set HIKYU_UI_TEST_URL).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 const accounts=[{id:'a1',type:'checking',name:'Everyday Checking',suffix:'1037',balance:1000,status:'active'},{id:'a2',type:'savings',name:'Everyday Saving',suffix:'2000',balance:500,status:'active'},{id:'a3',type:'credit',name:'Credit',suffix:'3000',balance:50,limit:1000,status:'active'}];
 let payees=[],budgets=[],locked=false;
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1',''),method=req.method(),body=req.postDataJSON();let result=[];
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
  await route.fulfill({json:result});
 });
 const base=process.env.HIKYU_UI_TEST_URL||'http://127.0.0.1:8765';
 const go=async hash=>{await page.goto(base+'/#'+hash);await page.locator('.section-content').waitFor();};
 const review=async banking=>{
  await page.locator('[name=amount]').fill('10.25');await page.getByRole('button',{name:/^Review/}).click();
  if(banking||await page.locator('.transfer-pin').count())await page.locator(banking?'.finance-pin':'.transfer-pin').fill('1037');
  await page.getByRole('button',{name:'Request verification code'}).click();
  await page.locator(banking?'.finance-code-hint':'.payment-code-hint').filter({hasText:'123456'}).waitFor();
  await page.locator(banking?'.finance-code':'.payment-code').fill('123456');
  await page.locator('[data-confirm]').click();await page.getByRole('heading',{name:/completed/i}).waitFor();
 };
 await go('pay-transfer');await review(false);console.log('PASS internal transfer review, verification, request and receipt');
 await go('pay-transfer?tab=payees');await page.getByText('No saved recipients yet.',{exact:true}).waitFor();
 await page.locator('[name=identifier]').fill('demo.recipient');await page.locator('[name=alias]').fill('Friend');
 await page.getByRole('button',{name:'Save recipient',exact:true}).click();await page.getByText('Verify your recipient before saving.').waitFor();
 await page.getByRole('button',{name:'Verify recipient',exact:true}).click();await page.locator('.recipient-preview').filter({hasText:'Demo Recipient'}).waitFor();
 await page.getByRole('button',{name:'Save recipient',exact:true}).click();await page.getByRole('heading',{name:'Friend',exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('[name=alias]').fill('Friend updated');await page.getByRole('button',{name:'Save recipient',exact:true}).click();await page.getByRole('heading',{name:'Friend updated'}).waitFor();
 await page.locator('.payee-list a').click();await page.locator('[name=recipientUsername]').waitFor();assert.equal(await page.locator('[name=recipientUsername]').inputValue(),'demo.recipient');
 await page.locator('[name=amount]').fill('10.25');await page.getByRole('button',{name:'Review payment',exact:true}).click();await page.getByText('Verify your recipient before continuing.').waitFor();
 await page.locator('.saved-recipient').selectOption('demo.recipient');await page.getByRole('button',{name:'Verify recipient',exact:true}).click();await page.locator('.recipient-preview').filter({hasText:'Demo Recipient'}).waitFor();await review(false);
 console.log('PASS recipient save/edit/select and mandatory re-verification; peer payment');
 await go('pay-transfer?tab=bill');await page.getByText('No saved billers yet. Add a biller to get started.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Add biller',exact:true}).click();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');assert.ok(await page.locator('dialog').evaluate(dialog=>dialog.contains(document.activeElement)));await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.ok(await page.locator('[data-add-biller]').evaluate(button=>button===document.activeElement));await page.getByRole('button',{name:'Add biller',exact:true}).click();await page.locator('.biller-form [name=biller]').selectOption('power');await page.locator('[name=alias]').fill('Home power');await page.locator('[name=reference]').fill('demo-001');await page.getByRole('button',{name:'Save biller',exact:true}).click();await page.getByText('Home power',{exact:true}).waitFor();
await page.locator('[name=payeeId]').selectOption('p2');
 assert.equal(await page.locator('[name=payeeId]').evaluate(el=>getComputedStyle(el).appearance),'none');
 assert.equal(await page.locator('button.primary-button').last().evaluate(el=>getComputedStyle(el).justifyContent),'center');
 await review(true);console.log('PASS inline biller creation, saved biller selection, bill payment and shared control styling');
 await go('accounts?tab=cards');await page.locator('[data-lock=a1]').click();await page.getByRole('button',{name:'Unlock card'}).waitFor();await page.getByRole('button',{name:'Unlock card'}).click();await page.getByRole('button',{name:'Lock card'}).first().waitFor();
 await page.getByRole('link',{name:'Repay credit',exact:true}).click();await page.locator('[name=targetAccountId]').waitFor();assert.equal(await page.locator('[name=targetAccountId]').inputValue(),'a3');await review(true);console.log('PASS card lock/unlock and account-specific credit repayment');
 await go('insights');await page.locator('[name=limit]').fill('100');await page.getByRole('button',{name:'Save budget'}).click();await page.getByRole('heading',{name:'Shopping',exact:true}).waitFor();await page.locator('[data-edit-budget]').click();await page.locator('[name=limit]').fill('120');await page.getByRole('button',{name:'Save budget'}).click();await page.getByText('$0.00 spent of $120.00').waitFor();await page.locator('[data-delete-budget]').click();await page.getByText(/No budgets for this month/).waitFor();
 await page.getByRole('link',{name:'AI assistant',exact:true}).click();await page.locator('#message').fill('Spending');await page.locator('#chat-form button').click();await page.getByText('Based on your demo spending.').waitFor();console.log('PASS budget CRUD and existing assistant integration');
 await go('demo');await page.locator('[name=merchant]').fill('Demo shop');await review(true);console.log('PASS simulated purchase review and receipt');
 await page.goto(base+'/#transactions');await page.locator('[data-transaction]').first().click();await page.getByText('receipt-uuid',{exact:true}).waitFor();console.log('PASS transaction search, details and receipt identifier');
 await go('pay-transfer?tab=payees');await page.locator('[data-delete-payee]').click();await page.getByText('No saved recipients yet.',{exact:true}).waitFor();
 await go('pay-transfer?tab=bill');await page.locator('[data-delete-biller]').click();await page.getByText('No saved billers yet. Add a biller to get started.',{exact:true}).waitFor();console.log('PASS recipient and biller deletion');
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});for(const hash of ['overview','pay-transfer?tab=bill','accounts?tab=cards','insights','demo']){
   await page.goto(base+'/#'+hash);await page.locator('#app h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${hash}`);
  }
 }
 console.log('PASS desktop/mobile overflow checks');
 await go('banking?tab=bill');await page.getByRole('heading',{name:'Bill Pay',exact:true}).waitFor();assert.ok(page.url().includes('#pay-transfer?tab=bill'));console.log('PASS legacy banking deep link');
 assert.equal(errors.length,0,errors.join('\n'));
 const operations=writes.filter(w=>w.path==='/banking/operations'||w.path==='/payments'||w.path==='/transfers');assert.equal(operations.length,5);for(const op of operations){assert.equal(op.body.amount,'10.25');assert.equal(op.body.verificationCode,'123456');assert.ok(op.body.idempotencyKey);}
 console.log('PASS 5 operation request payloads preserve amount strings, verification and idempotency keys');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

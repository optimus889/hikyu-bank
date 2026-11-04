import test from 'node:test';import assert from 'node:assert/strict';
import { operationSummary,BANKING_TABS } from '../js/views/banking-view.js';
const accounts=[{id:'checking',name:'Everyday Checking'},{id:'credit',name:'Demo Credit'}],payees=[{id:'power',alias:'Home power',reference:'demo-001'}];
test('purchase review uses merchant and source account rather than a transfer target',()=>{const summary=operationSummary({type:'purchase',sourceAccountId:'checking',merchant:'Demo shop',amount:'12.50'},accounts,payees);assert.equal(summary.source,'Everyday Checking');assert.equal(summary.destination,'Demo shop');assert.equal(summary.amount,'$12.50');});
test('credit repayment review resolves the owned credit destination',()=>{assert.equal(operationSummary({type:'repayment',sourceAccountId:'checking',targetAccountId:'credit',amount:25},accounts,payees).destination,'Demo Credit');});
test('bill review includes the simulation reference being authorized',()=>{assert.equal(operationSummary({type:'bill',sourceAccountId:'checking',payeeId:'power',amount:10},accounts,payees).destination,'Home power · demo-001');});
test('all second batch tools have a named navigation entry',()=>{assert.deepEqual(Object.keys(BANKING_TABS).sort(),['bill','budgets','cards','payees','purchase','repayment']);});

test('bill review shows the authoritative mock biller when catalog is available',()=>{const p=[{id:'power',alias:'Home power',identifier:'electric',reference:'demo-001'}];assert.equal(operationSummary({type:'bill',payeeId:'power',amount:35},accounts,p,[{code:'electric',name:'Demo Electric'}]).destination,'Home power · Demo Electric · demo-001');});

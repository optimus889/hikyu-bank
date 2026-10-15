import { bankingAPI } from "../api/banking.js";
import { heading, table, escape, money } from "../components/ui.js";
import { openDialog } from "../components/dialog.js";
import { extensionsAPI } from "../api/extensions.js";
export function renderTransactionsView(root, accounts) {
 let active=true, version=0, page=0, timer;
 root.innerHTML=heading("THE DETAILS", "Every transaction, a clearer picture.", "Search current database activity. Internal transfers are shown separately.")+`<section class="panel transactions-panel"><form class="transaction-filters">
 <label>Account<select name="accountId"><option value="">All accounts</option>${accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join("")}</select></label>
 <label>Search<input name="q" type="search" maxlength="100" placeholder="Merchant, category or note…"></label>
 <label>Category<input name="category" maxlength="60" placeholder="Exact category"></label>
 <label>From<input type="date" name="from"></label><label>To<input type="date" name="to"></label>
 <label>Minimum amount<input name="min" type="number" min="0" step="0.01"></label><label>Maximum amount<input name="max" type="number" min="0" step="0.01"></label>
 <label>Type<select name="kind"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Internal transfer</option><option value="peer_transfer">Payment to / from another person</option><option value="credit_payment">Credit repayment</option></select></label>
 <label>Sort<select name="sort"><option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option><option value="amount_desc">Largest amount</option><option value="amount_asc">Smallest amount</option></select></label>
 <button class="primary-button">Apply filters</button></form><details class="statement-export"><summary>Export a CSV statement</summary><form class="bank-form statement-form" data-export><label>Account<select name="accountId"><option value="">All accounts</option>${accounts.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join("")}</select></label><label>From<input type="date" name="from" value="${new Date().toISOString().slice(0,7)}-01" required></label><label>To<input type="date" name="to" value="${new Date().toISOString().slice(0,10)}" required></label><button class="secondary-button">Download CSV</button><p role="status"></p></form><p class="muted">Inclusive dates, up to 367 days and 10,000 records. Completed financial records are exported without modifying them.</p></details><div class="transaction-results" aria-live="polite"></div>
 <div class="extension-actions"><button class="text-link" data-prev>Previous</button><span class="page-status"></span><button class="text-link" data-next>Next</button></div></section>`;
 const form=root.querySelector("form"), results=root.querySelector(".transaction-results"), prev=root.querySelector('[data-prev]'),next=root.querySelector('[data-next]');
 const exportForm=root.querySelector("[data-export]");let exportBusy=false;exportForm.onsubmit=async e=>{e.preventDefault();if(exportBusy)return;exportBusy=true;const button=exportForm.querySelector("button"),status=exportForm.querySelector("[role=status]");button.disabled=true;status.textContent="Preparing statement…";try{await bankingAPI.downloadStatement(Object.fromEntries([...new FormData(exportForm)].filter(([,v])=>v!=="")));if(active)status.textContent="Statement downloaded.";}catch(error){if(active)status.textContent=error.message;}finally{exportBusy=false;if(active)button.disabled=false;}};
 const initial=new URLSearchParams(location.hash.split("?")[1]||"").get("account");if(accounts.some(a=>a.id===initial))form.elements.accountId.value=initial;
 async function load(){const mine=++version;prev.disabled=next.disabled=true;results.innerHTML='<p role="status">Loading transactions…</p>';
  const params=Object.fromEntries([...new FormData(form)].filter(([,v])=>v!==""));params.page=page;params.size=10;
  try{const data=await extensionsAPI.search(params);if(!active || mine!==version)return;
   results.innerHTML=data.items.length?table(data.items):'<p class="empty">No transactions match these filters.</p>';
   root.querySelector(".page-status").textContent=`Page ${page+1} · ${data.total} records`;prev.disabled=page===0;next.disabled=(page+1)*10>=data.total;
  }catch(error){if(active && mine===version){results.innerHTML=`<p role="alert">${escape(error.message)}</p><button class="text-link" data-retry>Retry</button>`;results.querySelector('[data-retry]').onclick=load;root.querySelector(".page-status").textContent="";}}
 }
 form.onsubmit=e=>{e.preventDefault();clearTimeout(timer);page=0;load();};form.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=0;load();},350);};prev.onclick=()=>{page--;load();};next.onclick=()=>{page++;load();};
 results.onclick=async event=>{const button=event.target.closest('[data-transaction]');if(!button)return;button.disabled=true;
  try{const t=await extensionsAPI.detail(button.dataset.transaction);if(!active)return;openDialog("Transaction details",`<dl class="transaction-detail"><dt>Account</dt><dd>${escape(accounts.find(a=>a.id===t.accountId)?.name || "Account")}</dd><dt>Date</dt><dd>${escape(t.date)}</dd><dt>Amount</dt><dd>${money(t.amount)}</dd><dt>Type</dt><dd>${escape(({income:"Income",expense:"Expense",transfer:"Internal transfer",peer_transfer:"Payment to / from another person",credit_payment:"Credit repayment"})[t.kind]||t.kind)}</dd><dt>Category</dt><dd>${escape(t.category)}</dd><dt>Note</dt><dd>${escape(t.note || "No note")}</dd><dt>Transaction ID</dt><dd>${escape(t.id)}</dd>${t.operationId?`<dt>Banking receipt</dt><dd>${escape(t.operationId)}</dd>`:""}${t.peerPaymentId?`<dt>Payment receipt</dt><dd>${escape(t.peerPaymentId)}</dd>`:""}${t.transferId?`<dt>Transfer receipt</dt><dd>${escape(t.transferId)}</dd>`:""}</dl>`);}catch(error){if(active)openDialog("Could not load transaction",`<p>${escape(error.message)}</p>`);}finally{button.disabled=false;}
 };load();return ()=>{active=false;clearTimeout(timer);};
}

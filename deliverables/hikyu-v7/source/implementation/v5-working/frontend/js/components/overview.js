import { heading, escape, money } from "./ui.js";
import { accountCard, showAccount } from "./accounts.js";
import { alertSidebar, showAlertForm, showManageAlerts } from "./alerts.js";
import { showOpenAccount } from "./open-account.js";

/** Overview shows at most five recent records; full history lives in Transactions. */
export function overview(accounts, user = {}, transactions = []) {
  const firstName = escape(user.firstName || user.name?.split(" ")[0] || "there");
  return `
    ${heading("PERSONAL BANKING", `Welcome back, ${firstName}.`, "Your accounts. One clear view.")}
    <div role="navigation" class="extension-actions" aria-label="Quick actions"><a class="primary-button" href="#pay-transfer">Transfer</a><a class="secondary-button" href="#pay-transfer?tab=bill">Pay bills</a>${accounts.some(a=>a.type==='credit'&&a.status==='active')?'<a class="secondary-button" href="#accounts?tab=repayment">Repay credit</a>':''}</div>
    <div class="overview-layout">
      <section class="overview-main" aria-labelledby="accounts-title">
        <div class="panel-heading">
        <h2 id="accounts-title">Your accounts</h2>
        <span class="muted">USD · Simulated balances</span>
        </div>
        <div class="overview-accounts">${accounts.map(accountCard).join("")}</div>
        <section class="open-account-banner">
          <span class="open-symbol" aria-hidden="true">+</span>
          <div>
        <h2>Make room for what's next.</h2>
        <p>Everyday banking, bigger plans, new possibilities.</p>
        </div>
          <button id="open-account" class="primary-button">Open a new account →</button>
        </section>
        <section class="panel recent-overview"><h2>Recent transactions</h2><ul class="transfer-history">${[...transactions].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map(t=>`<li><strong>${escape(t.name)} · ${money(t.amount)}</strong><p>${escape(t.category)} · ${escape(t.date)}</p></li>`).join('')||'<li class="empty-state">No recent transactions yet.</li>'}</ul><a class="text-link" href="#transactions">View all transactions →</a></section>
      </section>
      ${alertSidebar()}
    </div>
  `;
}

export function bindOverview(root, accounts, onAccountsChanged) {
  root.querySelectorAll("[data-account]").forEach((button) => {
    button.onclick = () => showAccount(button.dataset.account);
  });
  root.querySelector("#open-account").onclick = () =>
    showOpenAccount(onAccountsChanged);
  root.querySelector("#set-alert").onclick = () => showAlertForm(accounts);
  root.querySelector("#manage-alerts").onclick = showManageAlerts;
}

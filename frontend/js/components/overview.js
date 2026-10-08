import { heading, escape } from "./ui.js";
import { accountCard, showAccount } from "./accounts.js";
import { alertSidebar, showAlertForm, showManageAlerts } from "./alerts.js";
import { showOpenAccount } from "./open-account.js";

/** Overview intentionally contains no transaction rows or spending charts. */
export function overview(accounts, user = {}) {
  const firstName = escape(user.firstName || user.name?.split(" ")[0] || "there");
  return `
    ${heading("PERSONAL BANKING", `Welcome back, ${firstName}.`, "Your accounts. One clear view.")}
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

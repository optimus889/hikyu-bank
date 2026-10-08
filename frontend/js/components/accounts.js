import { escape, money } from "./ui.js";
import { accountsAPI } from "../api/accounts.js";
import { openDialog } from "./dialog.js";

export function accountCard(account) {
  const pending = account.status === "pending";
  const debt = ["credit", "loan"].includes(account.type);
  return /* HTML */ `
    <button class="overview-account" data-account="${escape(account.id)}">
      <span class="account-card-top">
        <span class="account-symbol" aria-hidden="true">
          ${escape(account.name.charAt(0).toUpperCase())}
        </span>
        <span class="account-identity">
          <strong>${escape(account.name)}</strong>
          <small>•••• ${escape(account.suffix)}</small>
        </span>
      </span>
      <span class="account-amount">
        ${pending ? "Application received" : money(account.balance)}
      </span>
      <span class="account-caption">
        ${pending ? "Pending demo review" : debt ? "Outstanding balance" : "Current balance"}
      </span>
      <span class="account-card-footer">
        View account details
        <span aria-hidden="true">→</span>
      </span>
    </button>
  `;
}

export async function showAccount(id) {
  const dialog = openDialog("Account details", '<p role="status">Loading account…</p>');
  try {
    const account = await accountsAPI.get(id);
    if (!dialog.open) return;
    const debt = ["credit", "loan"].includes(account.type);
    const pending = account.status === "pending";
    const balanceDescription = pending
      ? "Demo application received. No account funds or credit have been issued."
      : debt
        ? "Outstanding balance · USD"
        : "Current balance · USD";
    const section = document.createElement("section");
    section.innerHTML = /* HTML */ `
      <p class="eyebrow">${escape(account.type)} · •••• ${escape(account.suffix)}</p>
      <h3>${escape(account.name)}</h3>
      <p class="detail-balance">
        ${pending ? "Pending review" : money(account.balance)}
      </p>
      <p>${balanceDescription}</p>
      ${
        account.limit != null
          ? /* HTML */ `
              <dl class="account-facts">
                <div>
                  <dt>Credit limit</dt>
                  <dd>${money(account.limit)}</dd>
                </div>
                <div>
                  <dt>Available credit</dt>
                  <dd>${money(Math.max(0, account.limit - account.balance))}</dd>
                </div>
                <div>
                  <dt>Minimum payment</dt>
                  <dd>${money(account.minimumDue || 0)}</dd>
                </div>
                <div>
                  <dt>Payment due</dt>
                  <dd>${escape(account.dueDate || "—")}</dd>
                </div>
              </dl>
            `
          : ""
      }
      <a
        class="primary-button"
        href="#transactions?account=${encodeURIComponent(account.id)}"
      >
        View transactions →
      </a>
      <p class="muted">
        Simulated account data. No payments or transfers are processed.
      </p>
    `;
    dialog.querySelector('[role="status"]').replaceWith(section);
    section.querySelector("a").onclick = () => dialog.close();
  } catch (error) {
    if (dialog.open)
      dialog.querySelector('[role="status"]').textContent = error.message;
  }
}

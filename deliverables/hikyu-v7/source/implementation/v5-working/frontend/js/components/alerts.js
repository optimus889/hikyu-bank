import { alertsAPI } from "../api/alerts.js";
import { alertTypes } from "./alert-options.js";
import { escape, money } from "./ui.js";
import { openDialog } from "./dialog.js";
import { apiConfig } from "../api/client.js";
import { notificationsAPI } from "../api/notifications.js";

export function alertSidebar() {
  return /* HTML */ `
    <aside class="overview-alerts" aria-labelledby="alerts-title">
      <span class="alert-symbol" aria-hidden="true">◷</span>
      <p class="eyebrow">A LITTLE PEACE OF MIND</p>
      <h2 id="alerts-title">Stay one step ahead.</h2>
      <p>Balance updates, bill reminders and savings goals. On your terms.</p>
      <button class="primary-button" id="set-alert">
        Set an alert
        <span aria-hidden="true">+</span>
      </button>
      <button class="text-link" id="manage-alerts">Manage alerts →</button>
      <small>${apiConfig.demo
        ? "Test reminders in Manage alerts, then review them in Alert inbox."
        : "Review delivered reminders in Alert inbox."}</small>
    </aside>
  `;
}

export function showAlertForm(accounts, existing = null, onSaved = null) {
  const typeOptions = alertTypes
    .map(
      (item) => /* HTML */ `
        <option value="${item.type}">${item.label}</option>
      `,
    )
    .join("");
  const accountOptions = accounts
    .map(
      (item) => /* HTML */ `
        <option value="${escape(item.id)}">
          ${escape(item.name)} · ${escape(item.suffix)}
        </option>
      `,
    )
    .join("");
  const dialog = openDialog(
    existing ? "Edit alert" : "Set an alert",
    /* HTML */ `
      <form class="bank-form">
        <label>
          Remind me about
          <select name="type">
            ${typeOptions}
          </select>
        </label>
        <label>
          Account
          <select name="accountId">
            ${accountOptions}
          </select>
        </label>
        <label>
          Alert name
          <input name="title" value="Low balance" maxlength="80" required />
        </label>
        <label id="amount-field">
          <span>Alert below this balance (USD)</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            value="100"
            required
          />
        </label>
        <label id="date-field" hidden>
          Remind me on
          <input name="date" type="date" disabled />
        </label>
        <label>
          Delivery preference
          <select name="channel">
            <option>Email</option>
            <option>SMS</option>
            <option>In-app</option>
            <option>Calendar</option>
          </select>
        </label>
        <p class="form-note">
          Settings are saved for this demo. Email, SMS and calendar delivery require a
          backend integration.
        </p>
        <button class="primary-button" type="submit">Save alert</button>
        <p role="status"></p>
      </form>
    `,
  );
  const form = dialog.querySelector("form");
  form.elements.type.onchange = () => {
    const kind = alertTypes.find((item) => item.type === form.elements.type.value);
    form.elements.title.value = kind.label;
    for (const name of ["amount", "date"]) {
      const selected = kind.field === name;
      form.querySelector(`#${name}-field`).hidden = !selected;
      form.elements[name].disabled = !selected;
      form.elements[name].required = selected;
    }
    form.querySelector("#amount-field span").textContent = `${kind.hint} (USD)`;
  };
  if (existing) {
    form.elements.type.value = existing.type;
    form.elements.type.onchange();
    form.elements.accountId.value = existing.accountId;
    form.elements.title.value = existing.title;
    form.elements.channel.value = existing.channel;
    if (existing.amount != null) form.elements.amount.value = existing.amount;
    if (existing.date) form.elements.date.value = existing.date;
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const input = Object.fromEntries(new FormData(form));
    if (input.amount) input.amount = Number(input.amount);
    // Keep an existing dated reminder's planned amount when this form only edits its date.
    if (existing?.amount != null && existing.type === input.type && input.date) {
      input.amount = existing.amount;
    }
    try {
      if (existing) {
        await alertsAPI.update(existing.id, input);
      } else {
        await alertsAPI.create(input);
      }
      onSaved?.();
      if (!dialog.open) return;
      form.innerHTML = /* HTML */ `
        <div class="success-panel" role="status">
          <h3>Alert saved</h3>
          <p>You can review or turn it off in Manage alerts.</p>
        </div>
        <button class="primary-button" type="button">Done</button>
      `;
      form.querySelector("button").onclick = () => dialog.close();
    } catch (error) {
      form.querySelector('[role="status"]').textContent = error.message;
      button.disabled = false;
    }
  };
}

export async function showManageAlerts() {
  const dialog = openDialog("Your alerts", '<p role="status">Loading alerts…</p>');
  const status = dialog.querySelector('[role="status"]');
  try {
    const items = await alertsAPI.list();
    if (!dialog.open) return;
    status.textContent = items.length
      ? (apiConfig.demo
        ? "Manage your preferences. Demo tests appear in Alert inbox only."
        : "Manage your notification preferences.")
      : "No alerts yet. Use Set an alert to add one.";
    const list = document.createElement("div");
    list.className = "alert-list";
    list.innerHTML = items
      .map(
        (item) => /* HTML */ `
          <div class="saved-alert">
            <span>
              <strong>${escape(item.title)}</strong>
              <small>
                ${escape(item.channel)} ·
                ${item.date ? escape(item.date) : money(item.amount)}
              </small>
            </span>
            <input
              type="checkbox"
              data-id="${escape(item.id)}"
              ${item.enabled ? "checked" : ""}
              aria-label="Enable ${escape(item.title)}"
            />
            <button type="button" class="test-alert" data-edit="${escape(item.id)}">Edit</button>
            <button type="button" class="test-alert" data-delete="${escape(item.id)}">Delete</button>
            ${apiConfig.demo ? `
              <button type="button" class="test-alert" data-test="${escape(item.id)}"
                ${item.enabled ? "" : "disabled"}>
                Test alert
              </button>
            ` : ""}
          </div>
        `,
      )
      .join("");
    dialog.append(list);
    list.onchange = async (event) => {
      const checkbox = event.target;
      checkbox.disabled = true;
      try {
        await alertsAPI.toggle(checkbox.dataset.id, checkbox.checked);
        const test = checkbox.closest(".saved-alert").querySelector("[data-test]");
        if (test) test.disabled = !checkbox.checked;
        status.textContent = "Alert preference saved.";
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        status.textContent = error.message;
      } finally {
        checkbox.disabled = false;
      }
    };
    list.addEventListener("click", async (event) => {
      const edit = event.target.closest("[data-edit]");
      if (edit) {
        const selected = items.find((item) => item.id === edit.dataset.edit);
        try {
          const { accountsAPI } = await import("../api/accounts.js");
          const accounts = await accountsAPI.list();
          dialog.close();
          showAlertForm(accounts, selected);
        } catch (error) {
          status.textContent = error.message;
        }
        return;
      }
      const remove = event.target.closest("[data-delete]");
      if (remove) {
        remove.disabled = true;
        try {
          await alertsAPI.remove(remove.dataset.delete);
          remove.closest(".saved-alert").remove();
          status.textContent = "Alert deleted.";
        } catch (error) {
          status.textContent = error.message;
          remove.disabled = false;
        }
        return;
      }
      const button = event.target.closest("[data-test]");
      if (!button || button.disabled) return;
      button.disabled = true;
      try {
        await notificationsAPI.createTest(button.dataset.test);
        status.textContent = "Test alert added to your Alert inbox. No email or SMS was sent.";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        const enabled = button.closest(".saved-alert").querySelector("input").checked;
        button.disabled = !enabled;
      }
    });
  } catch (error) {
    status.textContent = error.message;
  }
}

import { notificationsAPI } from "../api/notifications.js";
import { apiConfig } from "../api/client.js";
import { escape } from "./ui.js";
import { openDialog } from "./dialog.js";

function notificationMarkup(item) {
  const time = new Date(item.createdAt);
  const timestamp = Number.isNaN(time.getTime()) ? "" : time.toLocaleString("en-US");
  return `
    <li class="inbox-item ${item.read ? "is-read" : "is-unread"}">
      <div class="inbox-item-heading">
        <h3>${escape(item.title)}</h3>
        <span class="inbox-state">${item.resolved ? "Resolved" : item.read ? "Read" : "Unread"}</span>
      </div>
      <p>${escape(item.body)}</p>
      <small>${escape(timestamp)}${item.source === "demo" ? " · Demo" : ""}</small>
      <div class="inbox-item-actions">
        <button type="button" data-action="read" data-id="${escape(item.id)}">
          ${item.read ? "Mark unread" : "Mark read"}
        </button>
        <button type="button" data-action="resolve" data-id="${escape(item.id)}">
          ${item.resolved ? "Reopen" : "Resolve"}
        </button>
        <button type="button" data-action="delete" data-id="${escape(item.id)}">
          Delete
        </button>
      </div>
    </li>
  `;
}

export function showNotificationInbox(onLoaded = () => {}) {
  const dialog = openDialog("Alert inbox", `
    <p class="inbox-description">Review your reminders and mark them as handled.</p>
    <div class="inbox-toolbar">
      <label for="inbox-filter">Show
        <select id="inbox-filter">
          <option value="all">All notifications</option>
          <option value="unread">Unread</option>
          <option value="open">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <button type="button" data-action="refresh">Refresh</button>
      <button type="button" data-action="read-all">Mark all read</button>
      ${apiConfig.demo ? `
        <button type="button" data-action="test">Create demo alert</button>
      ` : ""}
    </div>
    <p class="inbox-status" role="status">Loading notifications…</p>
    <ul class="inbox-list" aria-label="Notifications"></ul>
  `);
  dialog.classList.add("inbox-dialog");
  const list = dialog.querySelector(".inbox-list");
  const status = dialog.querySelector(".inbox-status");
  const filter = dialog.querySelector("#inbox-filter");
  let items = [];
  let busy = false;
  let loadVersion = 0;

  function paint() {
    const visible = items.filter((item) => (
      filter.value === "all" ||
      (filter.value === "unread" && !item.read) ||
      (filter.value === "open" && !item.resolved) ||
      (filter.value === "resolved" && item.resolved)
    ));
    list.innerHTML = visible.map(notificationMarkup).join("");
    status.textContent = visible.length
      ? `${visible.length} notification${visible.length === 1 ? "" : "s"}`
      : "No notifications here yet.";
  }

  async function load() {
    const current = ++loadVersion;
    const result = await notificationsAPI.list();
    if (!dialog.open || current !== loadVersion) return;
    items = result;
    paint();
    onLoaded(items);
  }

  filter.onchange = paint;
  dialog.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || busy) return;
    const action = button.dataset.action;
    const item = items.find((entry) => entry.id === button.dataset.id);
    busy = true;
    dialog.querySelectorAll("[data-action], select").forEach((control) => {
      control.disabled = true;
    });
    try {
      if (action === "test") {
        await notificationsAPI.createTest();
        filter.value = "all";
      } else if (action === "read-all") {
        await notificationsAPI.markAllRead();
      } else if (action === "read" && item) {
        await notificationsAPI.update(item.id, { read: !item.read });
      } else if (action === "resolve" && item) {
        await notificationsAPI.update(item.id, { resolved: !item.resolved });
      } else if (action === "delete" && item) {
        await notificationsAPI.remove(item.id);
      }
      await load();
    } catch (error) {
      status.textContent = error.message || "Unable to update your inbox. Try again.";
    } finally {
      busy = false;
      dialog.querySelectorAll("[data-action], select").forEach((control) => {
        control.disabled = false;
      });
      const next = [...list.querySelectorAll("[data-action]")].find((control) => (
        control.dataset.id === button.dataset.id && control.dataset.action === action
      ));
      if (dialog.open && !button.isConnected) (next || filter).focus();
    }
  });
  load().catch(() => {
    status.textContent = "Could not load notifications. Select Refresh to retry.";
  });
}

/** Bind only while authenticated; disposal prevents stale badge updates. */
export function bindNotificationInbox(button) {
  let active = true;
  let version = 0;

  function paintBadge(items) {
    if (!active) return;
    const count = items.filter((item) => !item.read).length;
    button.querySelector(".inbox-count").textContent = count > 99 ? "99+" : count;
    button.setAttribute("aria-label", `Alert inbox, ${count} unread notifications`);
    button.title = "Open alert inbox";
  }

  async function refreshBadge() {
    const current = ++version;
    try {
      const items = await notificationsAPI.list();
      if (!active || current !== version) return;
      paintBadge(items);
    } catch {
      if (!active || current !== version) return;
      button.querySelector(".inbox-count").textContent = "–";
      button.setAttribute("aria-label", "Alert inbox, unread count unavailable");
      button.title = "Open inbox to retry loading notifications";
    }
  }
  button.onclick = () => showNotificationInbox((items) => {
    version += 1;
    paintBadge(items);
  });
  const unsubscribe = notificationsAPI.subscribe(refreshBadge);
  refreshBadge();
  return () => {
    active = false;
    unsubscribe();
    button.onclick = null;
    button.querySelector(".inbox-count").textContent = "0";
  };
}

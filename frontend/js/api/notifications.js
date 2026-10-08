import { request, sendJSON } from "./client.js";

const changes = new EventTarget();

function announceChange() {
  changes.dispatchEvent(new Event("change"));
}

/** Local events refresh the UI; inbox records are stored on the server. */
export const notificationsAPI = {
  subscribe(listener) {
    changes.addEventListener("change", listener);
    return () => changes.removeEventListener("change", listener);
  },

  list() {
    return request("/notifications");
  },

  async update(id, fields) {
    await sendJSON(`/notifications/${encodeURIComponent(id)}`, "PATCH", fields);
    announceChange();
  },

  async markAllRead() {
    await sendJSON("/notifications/read-all", "PATCH", {});
    announceChange();
  },

  async remove(id) {
    await request(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
    announceChange();
  },

  async createTest(alertId = null) {
    const notification = await sendJSON("/notifications/test", "POST", { alertId });
    announceChange();
    return notification;
  },
};

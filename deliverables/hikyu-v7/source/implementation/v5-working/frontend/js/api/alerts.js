import { request, sendJSON } from "./client.js";

export const alertsAPI = {
  list() {
    return request("/alerts");
  },

  create(input) {
    return sendJSON("/alerts", "POST", input);
  },

  update(id, input) {
    return sendJSON(`/alerts/${encodeURIComponent(id)}`, "PUT", input);
  },

  remove(id) {
    return request(`/alerts/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  toggle(id, enabled) {
    return sendJSON(`/alerts/${encodeURIComponent(id)}`, "PATCH", { enabled });
  },
};

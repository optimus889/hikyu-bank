import { request, sendJSON } from "./client.js";

export const accountsAPI = {
  list() {
    return request("/accounts");
  },

  products() {
    return request("/accounts/products");
  },

  get(id) {
    return request(`/accounts/${encodeURIComponent(id)}`);
  },

  open(input) {
    return sendJSON("/accounts", "POST", input);
  },
};

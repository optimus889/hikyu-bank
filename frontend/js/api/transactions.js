import { request } from "./client.js";

export const transactionsAPI = {
  list(accountId = "") {
    const query = accountId
      ? `?accountId=${encodeURIComponent(accountId)}`
      : "";
    return request(`/transactions${query}`);
  },
};

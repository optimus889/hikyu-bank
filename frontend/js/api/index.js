import { sendJSON } from "./client.js";
import { accountsAPI } from "./accounts.js";
import { transactionsAPI } from "./transactions.js";

/** Public UI facade; no financial calculations or workflow rules live here. */
export const bankAPI = {
  getAccounts: accountsAPI.list,
  getTransactions: transactionsAPI.list,

  askAssistant(message) {
    return sendJSON("/assistant/messages", "POST", { message });
  },
};

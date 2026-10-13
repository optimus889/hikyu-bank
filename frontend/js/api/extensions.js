import { request, sendJSON } from "./client.js";
export const extensionsAPI = {
 paymentCode: (input) => sendJSON("/payment-verifications", "POST", input),
 recipient: (username) => sendJSON("/payments/recipient", "POST", { username }),
 payment: (input) => sendJSON("/payments", "POST", input),
 payments: () => request("/payments"),
 transfer: (input) => sendJSON("/transfers", "POST", input),
 transfers: () => request("/transfers"),
 search: (params) => request("/transactions/search?" + new URLSearchParams(params)),
 detail: (id) => request("/transactions/" + encodeURIComponent(id)),
 preferences: () => request("/settings/preferences"),
 savePreferences: (input) => sendJSON("/settings/preferences", "PUT", input),
 nickname: (id, name) => sendJSON("/accounts/" + encodeURIComponent(id) + "/nickname", "PATCH", { name }),
 password: (input) => sendJSON("/settings/password", "POST", input),
 securityAction: (action,password,newPin) => sendJSON("/settings/security/" + action,"POST",action === "pin" ? {password,newPin} : {password}),
 aiStatus: () => request("/assistant/status"),
};

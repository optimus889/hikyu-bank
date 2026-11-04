import { request, sendJSON } from "./client.js";

/** HTTP adapter only. Credential and verification rules belong to the backend. */
export const authAPI = {
  login(credentials) {
    return sendJSON("/auth/login", "POST", credentials);
  },

  sendCode(payload) {
    return sendJSON("/auth/code", "POST", payload);
  },

  verify(payload) {
    return sendJSON("/auth/verify", "POST", payload);
  },

  async getSession() {
    try {
      return await request("/auth/session");
    } catch (error) {
      if (error.status === 401) return null;
      throw error;
    }
  },

  logout() {
    return sendJSON("/auth/logout", "POST", {});
  },
};

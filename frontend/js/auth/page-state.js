/** Tab-local flow metadata. Never stores an entered password or PIN. */
const FLOW_KEY = "hikyu.auth.flow.v2";

export function readFlow() {
  try {
    const flow = JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null");
    if (!flow || !flow.challengeId || flow.expiresAt <= Date.now()) return null;
    return flow;
  } catch {
    return null;
  }
}

export function saveFlow(flow) {
  try {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
  } catch {
    throw new Error("Enable browser session storage to continue this local demo.");
  }
}

export function clearFlow() {
  try {
    sessionStorage.removeItem(FLOW_KEY);
  } catch {
    // No stored flow exists when session storage is disabled.
  }
}

export function toLogin(reason = "") {
  clearFlow();
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  window.location.replace(`./login.html${query}`);
}

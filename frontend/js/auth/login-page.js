import { authAPI } from "../api/auth.js";
import { apiConfig } from "../api/client.js";
import { DEMO_ACCOUNT, DEMO_ACCOUNTS } from "./demo-account.js";
import { clearFlow, saveFlow } from "./page-state.js";
import { renderAuthLayout, showError } from "./layout.js";

const root = document.querySelector("#auth-page");
let busy = false;

renderAuthLayout(root, {
  step: 1,
  content: `
    <div class="form-heading">
      <h1 id="form-title">Sign in to your account</h1>
      <p>Enter your username and password to continue.</p>
    </div>
    <form id="credentials-form" class="bank-form">
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username"
        maxlength="80" placeholder="Enter your username" required />
      <label for="password">Password</label>
      <div class="password-field">
        <input id="password" name="password" type="password"
          autocomplete="current-password" maxlength="128"
          placeholder="Enter your password" required />
        <button id="toggle-password" type="button" aria-pressed="false">Show</button>
      </div>
      <p id="auth-error" class="auth-error" role="alert"></p>
      <button type="submit" class="auth-primary">Continue <span>→</span></button>
      <p class="form-footnote">Next: verify with a text message or email.</p>
    </form>
    ${
      apiConfig.demo
        ? `
      <details class="demo-credentials">
        <summary>Need a demo account?</summary>
        <label for="demo-profile">Demo profile</label>
        <select id="demo-profile">
          ${DEMO_ACCOUNTS.map((profile) => `
            <option value="${profile.username}">${profile.name}</option>
          `).join("")}
        </select>
        <dl>
          <div><dt>PIN for email verification</dt><dd>${DEMO_ACCOUNT.pin}</dd></div>
          <div><dt>Password</dt><dd>${DEMO_ACCOUNT.password}</dd></div>
        </dl>
        <button id="fill-demo" class="auth-text-button" type="button">
          Use demo credentials
        </button>
      </details>
    `
        : ""
    }
  `,
});

const messages = {
  expired: "Your session or sign-in request expired. Please sign in again.",
  required: "Please sign in with your username and password first.",
  locked: "Too many verification attempts. Please start sign-in again.",
  signedout: "You have signed out.",
};
const reason = new URLSearchParams(location.search).get("reason");
showError(messages[reason] || "");

const form = root.querySelector("#credentials-form");
form.onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  const credentials = Object.fromEntries(new FormData(form));
  busy = true;
  showError("");
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    clearFlow();
    const response = await authAPI.login(credentials);
    saveFlow({
      challengeId: response.challengeId,
      methods: response.methods,
      expiresAt: response.expiresAt,
      method: "sms",
      delivery: null,
      resendAt: 0,
    });
    form.reset();
    // A real document navigation: verification is a separate page.
    window.location.assign("./verify.html");
  } catch (error) {
    showError(error.message || "Sign-in failed. Please try again.");
    button.disabled = false;
    button.innerHTML = "Continue <span>→</span>";
    busy = false;
  }
};

root.querySelector("#toggle-password").onclick = (event) => {
  const input = root.querySelector("#password");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  event.currentTarget.textContent = visible ? "Hide" : "Show";
  event.currentTarget.setAttribute("aria-pressed", String(visible));
};

root.querySelector("#fill-demo")?.addEventListener("click", () => {
  root.querySelector("#username").value = root.querySelector("#demo-profile").value;
  root.querySelector("#password").value = DEMO_ACCOUNT.password;
  root.querySelector("#username").focus();
});

// Check again after back/forward navigation; private pages do the same.
window.addEventListener("pageshow", async () => {
  try {
    if (await authAPI.getSession()) location.replace("./index.html");
  } catch {
    showError("Unable to check your session. You can retry signing in.");
  }
});

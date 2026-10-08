import { authAPI } from "../api/auth.js";
import { apiConfig } from "../api/client.js";
import { DEMO_ACCOUNT } from "./demo-account.js";
import { escape } from "../components/ui.js";
import { readFlow, saveFlow, toLogin } from "./page-state.js";
import { renderAuthLayout, showError } from "./layout.js";

const root = document.querySelector("#auth-page");
let flow = readFlow();
let busy = false;
let ticker;

function methodOptions() {
  return flow.methods
    .map(
      (method) => `
    <label class="method-card">
      <input type="radio" name="method" value="${escape(method.id)}"
        ${flow.method === method.id ? "checked" : ""} />
      <span class="method-symbol" aria-hidden="true">${method.id === "sms" ? "▯" : "@"}</span>
      <span>
        <strong>${method.id === "sms" ? "Text message" : "Email"}</strong>
        <small>${escape(method.destination)}</small>
      </span>
      <span class="method-detail">${method.id === "sms" ? "6-digit code" : "Code + PIN"}</span>
    </label>
  `,
    )
    .join("");
}

function verificationFields() {
  if (!flow.delivery) return '<p id="auth-error" class="auth-error" role="alert"></p>';
  return `
    <form id="verification-form" class="bank-form verification-fields">
      <label for="otp">6-digit verification code</label>
      <input id="otp" name="code" class="otp-input" type="text"
        inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
        autocomplete="one-time-code" placeholder="000000" required />
      ${
        flow.method === "email"
          ? `
        <label for="card-pin">4-digit demo card PIN</label>
        <input id="card-pin" name="pin" type="password" inputmode="numeric"
          pattern="[0-9]{4}" maxlength="4" autocomplete="off"
          placeholder="••••" required />
        <p class="field-hint">Use the demo PIN only, never your real card PIN.</p>
      `
          : ""
      }
      <p id="auth-error" class="auth-error" role="alert"></p>
      <button type="submit" class="auth-primary">Verify & sign in <span>→</span></button>
    </form>
    ${
      apiConfig.demo && flow.delivery.demoCode
        ? `
      <aside class="demo-code" aria-label="Demo message">
        <span>SIMULATED ${flow.method === "email" ? "EMAIL" : "TEXT MESSAGE"}</span>
        <strong>${escape(flow.delivery.demoCode)}</strong>
        <small>One use · valid for 5 minutes</small>
        ${flow.method === "email" ? `<small>Demo PIN: <b>${DEMO_ACCOUNT.pin}</b></small>` : ""}
      </aside>
    `
        : ""
    }
  `;
}

function paint() {
  renderAuthLayout(root, {
    step: 2,
    content: `
      <div class="form-heading">
        <p class="identity-confirmed">✓ Username and password confirmed</p>
        <h1 id="form-title">Verify your identity</h1>
        <p>Choose one of your registered contact methods.</p>
      </div>
      <fieldset class="method-options">
        <legend class="sr-only">Verification method</legend>
        ${methodOptions()}
      </fieldset>
      <button id="send-code" class="auth-secondary" type="button">Send code</button>
      <p id="code-timer" class="code-timer" role="status"></p>
      ${verificationFields()}
      <button id="back-login" class="auth-text-button back-login" type="button">
        ← Return to sign in
      </button>
    `,
  });

  root.querySelectorAll('input[name="method"]').forEach((radio) => {
    radio.onchange = () => {
      try {
        flow.method = radio.value;
        flow.delivery = null;
        saveFlow(flow);
        paint();
      } catch (error) {
        showError(error.message);
      }
    };
  });

  root.querySelector("#send-code").onclick = () =>
    run(async () => {
      flow.delivery = await authAPI.sendCode({
        challengeId: flow.challengeId,
        method: flow.method,
      });
      flow.resendAt = flow.delivery.resendAt;
      saveFlow(flow);
      paint();
      root.querySelector("#otp").focus();
    });

  const form = root.querySelector("#verification-form");
  if (form)
    form.onsubmit = (event) => {
      event.preventDefault();
      const fields = Object.fromEntries(new FormData(form));
      run(async () => {
        await authAPI.verify({
          ...fields,
          method: flow.method,
          challengeId: flow.challengeId,
        });
        form.reset();
        sessionStorage.removeItem("hikyu.auth.flow.v2");
        location.replace("./index.html");
      });
    };

  root.querySelector("#back-login").onclick = () =>
    run(async () => {
      await authAPI.logout();
      toLogin();
    });
  updateTimer();
}

async function run(action) {
  if (busy) return;
  busy = true;
  showError("");
  root.querySelectorAll("button, input").forEach((control) => {
    control.disabled = true;
  });
  try {
    await action();
  } catch (error) {
    if (["CHALLENGE_INVALID", "CHALLENGE_EXPIRED"].includes(error.code)) {
      toLogin("expired");
    } else if (error.code === "ATTEMPTS_EXCEEDED") {
      toLogin("locked");
    } else {
      showError(error.message || "Please try again.");
    }
  } finally {
    busy = false;
    root.querySelectorAll("button, input").forEach((control) => {
      control.disabled = false;
    });
    updateTimer();
  }
}

function updateTimer() {
  if (!flow) return;
  if (flow.expiresAt <= Date.now()) {
    toLogin("expired");
    return;
  }
  const resend = Math.max(0, Math.ceil((flow.resendAt - Date.now()) / 1000));
  const button = root.querySelector("#send-code");
  if (!button) return;
  button.disabled = busy || resend > 0;
  button.textContent =
    resend > 0
      ? `Request another code in ${resend}s`
      : flow.delivery
        ? "Resend code"
        : "Send verification code";
  const status = root.querySelector("#code-timer");
  if (flow.delivery) {
    const seconds = Math.max(
      0,
      Math.ceil((flow.delivery.expiresAt - Date.now()) / 1000),
    );
    status.textContent =
      seconds > 0
        ? `Code expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
        : "This code expired. Please request a new one.";
  } else {
    status.textContent = "A one-time code will be sent to your selected contact.";
  }
}

window.addEventListener("pageshow", async () => {
  try {
    if (await authAPI.getSession()) {
      location.replace("./index.html");
      return;
    }
    flow = readFlow();
    if (!flow) {
      toLogin("required");
      return;
    }
    paint();
    clearInterval(ticker);
    ticker = setInterval(updateTimer, 1000);
  } catch (error) {
    root.textContent =
      "Unable to load verification. Please return to the sign-in page.";
  }
});
window.addEventListener("pagehide", () => clearInterval(ticker));

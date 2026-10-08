import { brandMarkup } from "../components/brand.js";

export function renderAuthLayout(root, { step, content }) {
  const verifying = step === 2;
  root.innerHTML = `
    <div class="figma-auth-shell">
      <aside class="figma-auth-story" aria-label="About Hikyu Bank">
        <a href="./login.html" class="bank-brand" aria-label="Hikyu Bank home">
          ${brandMarkup()}
        </a>
        <div class="figma-auth-story-copy">
          <span class="figma-story-badge">SIMULATED BANKING</span>
          <h2>Clarity for every<br />financial decision.</h2>
          <p>See your accounts, understand your spending, and plan what comes next.</p>
        </div>
        <p class="figma-story-footer">Hikyu Bank · Your money, in focus.</p>
      </aside>
      <main class="figma-auth-main">
        <section class="figma-auth-content" aria-labelledby="form-title">
          <p class="auth-eyebrow">HIKYU ONLINE BANKING</p>
          <p class="figma-step">Step ${step} of 2 · ${verifying ? "Verify identity" : "Sign in"}</p>
          ${content}
          <p class="figma-security-note">
            This is a local demonstration with simulated bank data.
            No real messages or transactions are sent.
          </p>
        </section>
      </main>
    </div>
  `;
}

export function showError(message) {
  const target = document.querySelector("#auth-error");
  if (target) target.textContent = message;
}

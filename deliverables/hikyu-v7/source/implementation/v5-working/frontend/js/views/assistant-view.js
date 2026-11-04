import { extensionsAPI } from "../api/extensions.js";
import { bankAPI } from "../api/index.js";
import { heading, escape } from "../components/ui.js";
import { profileDetails } from "../components/user-profile.js";

/** Chat history belongs to the current dashboard, not server business logic. */
export function createAssistantView(user) {
  const { name, initials } = profileDetails(user);
  const firstName = user.firstName || name.split(" ")[0];
  const chat = [{
    role: "assistant",
    text: `Hi ${firstName}! Ask about your spending, subscriptions, or savings.`,
  }];

  return function mountAssistant(root) {
    let active = true;
    let busy = false;
    const suggestions = [
      "Where am I spending the most?",
      "Review my subscriptions",
      "How much can I save?",
    ];

    root.innerHTML = heading(
      "A LITTLE HELP FROM HIKYU",
      "Let's talk about your money.",
      "Simple insights, grounded in your demo transactions.",
    ) + `
      <section class="panel chat-panel">
        <div class="panel-heading">
          <h2>✧ Hikyu assistant</h2>
          <span class="demo-badge" id="ai-mode">Checking mode…</span>
        </div>
        <div id="messages" class="messages" aria-live="polite"></div>
        <div class="suggestions">
          ${suggestions.map((text) => `<button type="button">${escape(text)}</button>`).join("")}
        </div>
        <form id="chat-form" class="chat-form">
          <label class="sr-only" for="message">Your question</label>
          <input id="message" placeholder="Ask about your spending…" maxlength="1000" required>
          <button class="primary-button" type="submit">Send ↗</button>
        </form>
        <p class="chat-note" id="ai-note">Checking assistant configuration…</p>
      </section>
    `;

    extensionsAPI.aiStatus().then(status => {
      if (!active) return;
      root.querySelector("#ai-mode").textContent = status.mode === "demo" ? "Simulated AI" : "OpenAI mode";
      root.querySelector("#ai-note").textContent = status.description + (status.configured ? "" : " AI service is not configured.");
    }).catch(() => { if(active) root.querySelector("#ai-mode").textContent = "Mode unavailable"; });
    function paintChat() {
      if (!active) return;
      const messages = root.querySelector("#messages");
      messages.innerHTML = chat.map((item) => {
        const assistant = item.role === "assistant";
        return `
          <div class="message ${item.role}">
            <span class="message-avatar">${assistant ? "✧" : escape(initials)}</span>
            <div>
              <small>${assistant ? "Hikyu" : "You"}</small>
              <p>${escape(item.text)}</p>
            </div>
          </div>
        `;
      }).join("");
      messages.scrollTop = messages.scrollHeight;
    }

    const form = root.querySelector("#chat-form");
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (busy) return;
      const input = form.querySelector("input");
      const message = input.value.trim();
      if (!message) return;
      busy = true;
      input.value = "";
      chat.push({ role: "user", text: message });
      paintChat();
      const button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "Thinking…";
      try {
        const response = await bankAPI.askAssistant(message);
        chat.push({ role: "assistant", text: response.reply });
      } catch (error) {
        chat.push({ role: "assistant", text: error.message || "Could not fetch a response." });
      } finally {
        busy = false;
        if (active) {
          paintChat();
          button.disabled = false;
          button.textContent = "Send ↗";
        }
      }
    };

    root.querySelectorAll(".suggestions button").forEach((button) => {
      button.onclick = () => {
        if (busy) return;
        form.querySelector("input").value = button.textContent;
        form.requestSubmit();
      };
    });
    paintChat();
    return () => { active = false; };
  };
}

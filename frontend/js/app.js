import { bankAPI } from "./api/index.js";
import { overview, bindOverview } from "./components/overview.js";
import { closeDialogs } from "./components/dialog.js";
import { renderTransactionsView } from "./views/transactions-view.js";
import { createAssistantView } from "./views/assistant-view.js";

import { mountTransfers } from "./views/transfers-view.js";
import { mountSettings } from "./views/settings-view.js";

const ROUTE_NAMES = {
  "pay-transfer": "Pay & Transfer",
  settings: "Settings",
  overview: "Overview",
  transactions: "Transactions",
  assistant: "AI assistant",
};

/** Route orchestration only. Views display API data; workflows run on the server. */
export async function startDashboard(user) {
  const root = document.querySelector("#app");
  const mountAssistant = createAssistantView(user);
  let active = true;
  let version = 0;
  let accounts = [];
  let transactions = [];
  let disposeView = null;

  function currentRoute() {
    const route = location.hash.slice(1).split("?")[0];
    if (route === "transfers") return "pay-transfer";
    return route in ROUTE_NAMES ? route : "overview";
  }

  function updateNav(route) {
    document.querySelector("#breadcrumb").textContent = ROUTE_NAMES[route];
    document.querySelectorAll("[data-nav]").forEach((link) => {
      const selected = link.dataset.nav === route;
      link.classList.toggle("active", selected);
      if (selected) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function render() {
    if (!active) return;
    const currentVersion = ++version;
    const route = currentRoute();
    disposeView?.();
    disposeView = null;
    updateNav(route);
    if (route === "overview") {
      root.innerHTML = overview(accounts, user);
      bindOverview(root, accounts, async () => {
        const updated = await bankAPI.getAccounts();
        if (!active || currentVersion !== version) return;
        accounts = updated;
        render();
      });
    } else if (route === "transactions") {
      disposeView = renderTransactionsView(root, accounts);
    } else if (route === "pay-transfer") {
      disposeView = mountTransfers(root);
    } else if (route === "settings") {
      disposeView = mountSettings(root);
    } else {
      disposeView = mountAssistant(root);
    }
  }

  async function onRouteChange() {
    const mine = ++version;
    closeDialogs(); disposeView?.(); disposeView = null;
    root.innerHTML = '<p role="status">Loading your accounts…</p>';
    try {
      const latest = await bankAPI.getAccounts();
      if (!active || mine !== version) return;
      accounts = latest; render();
    } catch(error) { if(active && mine === version) root.textContent = error.message; }
  }

  root.innerHTML = '<p role="status">Loading your overview…</p>';
  try {
    [accounts, transactions] = await Promise.all([
      bankAPI.getAccounts(),
      bankAPI.getTransactions(),
    ]);
    if (active) {
      window.addEventListener("hashchange", onRouteChange);
      render();
    }
  } catch {
    root.innerHTML =
      '<div class="empty">Could not load your overview. Please sign out and retry.</div>';
  }

  return () => {
    active = false;
    version += 1;
    disposeView?.();
    closeDialogs();
    root.replaceChildren();
    window.removeEventListener("hashchange", onRouteChange);
  };
}

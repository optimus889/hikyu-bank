import { authAPI } from "./api/auth.js";
import { toLogin } from "./auth/page-state.js";
import { brandMarkup } from "./components/brand.js";
import { bindNotificationInbox } from "./components/notification-inbox.js";
import { renderUserProfile } from "./components/user-profile.js";

const dashboard = document.querySelector("#dashboard");
const signOut = document.querySelector("#sign-out");
const mobileMenu = document.querySelector("#mobile-menu");
const dashboardNav = document.querySelector("#dashboard-nav");
let stopDashboard = null;
let stopInbox = null;
let expiryTimer = null;
let opening = false;

function hideDashboard() {
  clearTimeout(expiryTimer);
  dashboard.hidden = true;
  stopDashboard?.();
  stopDashboard = null;
  stopInbox?.();
  stopInbox = null;
  closeMobileMenu();
  document.querySelector("#user-profile").replaceChildren();
}

function closeMobileMenu() {
  mobileMenu.setAttribute("aria-expanded", "false");
  mobileMenu.setAttribute("aria-label", "Open navigation menu");
  dashboardNav.classList.remove("is-open");
}

mobileMenu.addEventListener("click", () => {
  const open = mobileMenu.getAttribute("aria-expanded") !== "true";
  mobileMenu.setAttribute("aria-expanded", String(open));
  mobileMenu.setAttribute(
    "aria-label",
    open ? "Close navigation menu" : "Open navigation menu",
  );
  dashboardNav.classList.toggle("is-open", open);
});

dashboardNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMobileMenu();
});

async function checkSession() {
  if (opening) return;
  opening = true;
  try {
    const session = await authAPI.getSession();
    if (!session || session.expiresAt <= Date.now()) {
      hideDashboard();
      toLogin("required");
      return;
    }
    document.querySelector("#sidebar-brand").innerHTML = brandMarkup();
    renderUserProfile(document.querySelector("#user-profile"), session.user);
    dashboard.hidden = false;
    if (!stopInbox) {
      stopInbox = bindNotificationInbox(document.querySelector("#alert-inbox"));
    }
    if (!stopDashboard) {
      const { startDashboard } = await import("./app.js");
      stopDashboard = await startDashboard(session.user);
    }
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(
      () => {
        hideDashboard();
        toLogin("expired");
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
  } catch {
    hideDashboard();
    toLogin();
  } finally {
    opening = false;
  }
}

signOut.onclick = async () => {
  signOut.disabled = true;
  try {
    await authAPI.logout();
    hideDashboard();
    toLogin("signedout");
  } catch {
    document.querySelector("#session-error").textContent =
      "Sign-out failed. Please try again.";
    signOut.disabled = false;
  }
};

// Revalidate on refresh, tab resume and browser back/forward navigation.
window.addEventListener("pageshow", checkSession);
window.addEventListener("pagehide", hideDashboard);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkSession();
});

// A protected REST response can invalidate the UI before the expiry timer fires.
window.addEventListener("hikyu:session-expired", () => {
  hideDashboard();
  toLogin("expired");
});

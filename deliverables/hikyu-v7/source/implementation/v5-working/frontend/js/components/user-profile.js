import { escape } from "./ui.js";

/** Prefer explicit name fields; retain compatibility with the session API. */
export function profileDetails(user = {}) {
  const firstName = String(user.firstName || "").trim();
  const lastName = String(user.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const name = String(user.name || fullName || user.username || "User").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = firstName && lastName
    ? Array.from(firstName)[0] + Array.from(lastName)[0]
    : [parts[0], parts.length > 1 ? parts.at(-1) : ""]
      .filter(Boolean)
      .map((part) => Array.from(part)[0])
      .join("");

  return { name: name || "User", initials: (initials || "U").toUpperCase() };
}

export function renderUserProfile(target, user) {
  const { name, initials } = profileDetails(user);
  target.innerHTML = `
    <span class="user-initials" aria-hidden="true">${escape(initials)}</span>
    <span class="user-display-name">${escape(name)}</span>
  `;
  target.setAttribute("aria-label", `Signed in as ${name}`);
  target.title = name;
}

/** Native dialog provides focus trapping and Escape-key dismissal. */
export function openDialog(title, content) {
  closeDialogs();
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "bank-dialog";
  dialog.setAttribute("aria-labelledby", "dialog-title");
  dialog.innerHTML = `
    <header class="dialog-heading">
      <h2 id="dialog-title"></h2>
      <button type="button" data-close aria-label="Close dialog">✕</button>
    </header>
    ${content}
  `;
  dialog.querySelector("h2").textContent = title;
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function closeDialogs() {
  document.querySelectorAll(".bank-dialog").forEach((dialog) => dialog.close());
}

import { accountsAPI } from "../api/accounts.js";
import { escape } from "./ui.js";
import { openDialog } from "./dialog.js";

export async function showOpenAccount(onSaved) {
  const loading = openDialog(
    "Open a new account",
    '<p role="status">Loading account options…</p>',
  );
  let accountProducts;
  try {
    accountProducts = await accountsAPI.products();
  } catch (error) {
    loading.querySelector('[role="status"]').textContent = error.message;
    return;
  }
  if (!loading.open) return;
  loading.close();

  const alreadyOpenMessage = "You have already opened this account.";
  const options = accountProducts
    .map(
      (product, index) => /* HTML */ `
        <label class="product-option">
          <input
            type="radio"
            name="type"
            value="${product.type}"
            ${index === 0 ? "checked" : ""}
          />
          <span>
            <strong>${product.icon} ${product.name}</strong>
            <small>${product.description}</small>
          </span>
        </label>
      `,
    )
    .join("");
  const dialog = openDialog(
    "Open a new account",
    /* HTML */ `
      <p>Choose an account for your next chapter.</p>
      <form class="bank-form" id="open-account-form">
        <fieldset>
          <legend>Account type</legend>
          <div class="product-options">${options}</div>
        </fieldset>
        <label>
          Account nickname
          <input name="name" value="My checking" maxlength="60" required />
        </label>
        <p class="form-note">
          Demo only. Checking and savings open with $0. Credit card, loan and investment
          applications remain pending. No credit check or real account is created.
        </p>
        <button class="primary-button" type="submit">Continue with demo account</button>
        <p class="account-open-status" role="status"></p>
      </form>
    `,
  );
  const form = dialog.querySelector("form");
  const status = form.querySelector('[role="status"]');
  const submit = form.querySelector('[type="submit"]');

  function updateAvailability() {
    const type = form.elements.type.value;
    const alreadyOpen = accountProducts.find((item) => item.type === type)?.alreadyOpen;

    status.textContent = alreadyOpen ? alreadyOpenMessage : "";
    submit.disabled = alreadyOpen;
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "type") {
      const selected = accountProducts.find(
        (product) => product.type === event.target.value,
      );
      form.elements.name.value = `My ${selected.name.toLowerCase()}`;
      updateAvailability();
    }
  });
  updateAvailability();

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const account = await accountsAPI.open(Object.fromEntries(new FormData(form)));
      if (!dialog.open) return;
      await onSaved();
      if (!dialog.open) return;
      form.innerHTML = /* HTML */ `
        <div class="success-panel" role="status">
          <h3>
            ${account.status === "pending" ? "Application received" : "Your demo account is ready"}
          </h3>
          <p>${escape(account.name)} is now listed in your overview.</p>
        </div>
        <button class="primary-button" type="button">Back to overview</button>
      `;
      form.querySelector("button").onclick = () => dialog.close();
    } catch (error) {
      status.textContent = error.code === "ACCOUNT_ALREADY_OPEN"
        ? alreadyOpenMessage
        : error.message;
      submit.disabled = error.code === "ACCOUNT_ALREADY_OPEN";
    }
  };
}

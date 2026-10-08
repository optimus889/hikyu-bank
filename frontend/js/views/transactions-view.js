import { heading, table, escape } from "../components/ui.js";

export function renderTransactionsView(root, accounts, transactions) {
  const categories = [...new Set(transactions.map((t) => t.category))].sort();
  const categoryOptions = categories.map((c) => `<option>${c}</option>`).join("");

  root.innerHTML =
    heading(
      "THE DETAILS",
      "Every transaction, a clearer picture.",
      "Explore your simulated account activity.",
    ) +
    `
    <section class="panel">
      <div class="filter-row">
        <label>Account
          <select id="account-filter">
            <option value="all">All accounts</option>
            ${accounts.map((account) => `<option value="${escape(account.id)}">${escape(account.name)}</option>`).join("")}
          </select>
        </label>
        <label class="search-wrap">
          Search transactions
          <input type="search" id="search" placeholder="Search merchant or category…">
        </label>
        <label>
          Category
          <select id="category">
            <option value="all">All categories</option>
            ${categoryOptions}
          </select>
        </label>
      </div>
      <div id="transaction-results"></div>
    </section>
  `;

  const selectedAccount = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "account",
  );
  const accountFilter = document.querySelector("#account-filter");
  if (accounts.some((account) => account.id === selectedAccount))
    accountFilter.value = selectedAccount;

  const filter = () => {
    const query = document.querySelector("#search").value.toLowerCase();
    const category = document.querySelector("#category").value;
    const items = transactions.filter((t) => {
      const matchesQuery = (t.name + " " + t.category).toLowerCase().includes(query);
      const matchesCategory = category === "all" || t.category === category;
      const matchesAccount =
        accountFilter.value === "all" || t.accountId === accountFilter.value;
      return matchesQuery && matchesCategory && matchesAccount;
    });

    document.querySelector("#transaction-results").innerHTML = items.length
      ? table(items)
      : '<div class="empty">No transactions match. Try another search or category.</div>';
  };

  accountFilter.onchange = filter;
  document.querySelector("#search").oninput = filter;
  document.querySelector("#category").onchange = filter;
  filter();
}


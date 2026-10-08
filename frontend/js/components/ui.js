export const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);

export const date = (s) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

function transactionRow(t) {
  const isIncome = t.category === "Income";
  const sign = t.amount > 0 ? "+" : "−";
  const amountClass = t.amount > 0 ? "amount positive" : "amount";

  return `
    <tr>
      <td>
        <div class="merchant">
          <span class="merchant-icon ${isIncome ? "income-icon" : ""}">
            ${escape(t.icon || "·")}
          </span>
          <div>
            ${escape(t.name)}
            <small>${escape(t.category)}</small>
          </div>
        </div>
      </td>
      <td class="date-cell">${date(t.date)}, 2026</td>
      <td><span class="category">${escape(t.category)}</span></td>
      <td class="${amountClass}">${sign}${money(Math.abs(t.amount))}</td>
    </tr>
  `;
}

export function transactionRows(items) {
  return items.map(transactionRow).join("");
}

export function table(items) {
  return `
    <div class="table-scroll desktop-transactions">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date</th>
            <th>Category</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>${transactionRows(items)}</tbody>
      </table>
    </div>
    <ul class="mobile-transactions" aria-label="Transactions">
      ${items.map(transactionCard).join("")}
    </ul>
  `;
}

function transactionCard(transaction) {
  const income = transaction.amount > 0;
  const sign = income ? "+" : "−";

  return `
    <li class="transaction-card">
      <div class="transaction-card-main">
        <span class="merchant-icon ${income ? "income-icon" : ""}"
          aria-hidden="true">${escape(transaction.icon || "·")}</span>
        <div>
          <strong>${escape(transaction.name)}</strong>
          <small>${escape(transaction.category)} · ${date(transaction.date)}</small>
        </div>
      </div>
      <span class="transaction-card-amount ${income ? "positive" : ""}">
        ${sign}${money(Math.abs(transaction.amount))}
      </span>
    </li>
  `;
}

export function heading(eyebrow, title, desc, extra = "") {
  return `
    <div class="page-heading">
      <div>
        <div class="eyebrow">${eyebrow}</div>
        <h1>${title}</h1>
        <p>${desc}</p>
      </div>
      ${extra}
    </div>
  `;
}

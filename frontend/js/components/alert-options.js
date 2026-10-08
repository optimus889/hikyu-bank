/** Display labels and form hints; validation is owned by the backend. */
export const alertTypes = [
  {
    type: "low_balance",
    label: "Low balance",
    field: "amount",
    hint: "Alert below this balance",
  },
  {
    type: "large_transaction",
    label: "Large transaction",
    field: "amount",
    hint: "Alert above this amount",
  },
  {
    type: "payment_due",
    label: "Payment reminder",
    field: "date",
    hint: "Remind me on",
  },
  {
    type: "savings_goal",
    label: "Savings goal",
    field: "amount",
    hint: "Target balance",
  },
  {
    type: "scheduled",
    label: "Bill or savings reminder",
    field: "date",
    hint: "Remind me on",
  },
];

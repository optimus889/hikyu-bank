# Local validation walkthrough

Start with ./start.sh and open http://localhost:8080/login.html.

1. Sign in as each of the three profiles; verify name/initials and different balances.
2. As Cheng-Yang, open checking/savings again; expect the duplicate-account message.
3. Apply for a loan/investment; expect pending and zero balance.
4. Create a low-balance alert with a two-decimal threshold. Edit it, toggle it,
   create a test inbox message, resolve it and delete it. Then delete the alert.
5. Create an alert/test message and leave it saved. Stop/restart the application,
   sign in again and verify the state survives. Delete the message/alert afterwards.
6. As Mingyu, verify Cheng-Yang's account/alert/inbox IDs return 404 via REST.
7. In a database client, query the five hikyu tables and compare UI values.

For screenshots, use synthetic records only. Supplied diagrams describe local
schema/architecture; actual LCNC platform screenshots/AI evidence require the
separate workflow in database/AI-WORKFLOW.md. No deployed platform is claimed.

# Frontend

HTML/CSS/JavaScript modules served by Spring Boot. Start through the project-root
README; a standalone static server cannot provide the required `/api/v1` routes.

- `js/api`: same-origin REST clients, no provider token or database credentials.
- `js/auth`: two-page login and simulated MFA; three public demo profiles.
- `js/components`: account cards, alert CRUD dialogs, inbox and profile display.
- `js/views`: transaction and assistant screens.

`node --test tests/*.test.js` runs transport and rendering checks. User names,
account IDs and records come from the authenticated backend session/API.

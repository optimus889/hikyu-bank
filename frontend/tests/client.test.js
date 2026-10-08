import test from "node:test";
import assert from "node:assert/strict";
import { request, sendJSON } from "../js/api/client.js";

// Tests exercise transport boundaries, not backend business rules.
test("REST writes serialize JSON and include the application header", async () => {
  const original = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ id: "c657af79-f84c-4c22-a67b-807ee1b6d6ec" }), { status: 201 });
  };
  try {
    const result = await sendJSON("/accounts", "POST", { type: "loan", name: "Study" });
    assert.equal(result.id, "c657af79-f84c-4c22-a67b-807ee1b6d6ec");
    assert.equal(captured.url, "/api/v1/accounts");
    assert.equal(captured.options.credentials, "same-origin");
    assert.equal(captured.options.headers["X-Hikyu-Request"], "web");
    assert.deepEqual(JSON.parse(captured.options.body), { type: "loan", name: "Study" });
  } finally {
    globalThis.fetch = original;
  }
});

test("backend errors preserve status, code and user message", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: "ACCOUNT_ALREADY_OPEN",
    message: "You have already opened this account.",
  }), { status: 409 });
  try {
    await assert.rejects(request("/accounts"), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "ACCOUNT_ALREADY_OPEN");
      assert.equal(error.message, "You have already opened this account.");
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("204 responses do not try to parse an empty body", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    assert.equal(await sendJSON("/auth/logout", "POST", {}), null);
  } finally {
    globalThis.fetch = original;
  }
});

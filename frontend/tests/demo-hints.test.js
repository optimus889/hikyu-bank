import test from "node:test";
import assert from "node:assert/strict";
import { describeDemoProfile } from "../js/auth/demo-hints.js";
const profiles = [
  { username: "lee", defaultPin: "1037", pinChanged: false, defaultPassword: "demo", passwordChanged: false },
  { username: "fan", defaultPin: "9061", pinChanged: false, defaultPassword: "demo", passwordChanged: false },
];
test("Demo PIN hint follows the selected profile", () => {
  assert.match(describeDemoProfile(profiles, "lee").pin, /1037/);
  assert.match(describeDemoProfile(profiles, "fan").pin, /9061/);
  assert.doesNotMatch(describeDemoProfile(profiles, "fan").pin, /1037/);
});
test("Changed credentials never display stale defaults", () => {
  const hints = describeDemoProfile([{ username: "lee", defaultPin: null, pinChanged: true, defaultPassword: null, passwordChanged: true }], "lee");
  assert.match(hints.pin, /PIN changed/);
  assert.doesNotMatch(hints.pin, /1037|null/);
  assert.match(hints.password, /current password/);
});
test("Unavailable status gives no invented PIN and requires the current card PIN", () => {
  assert.match(describeDemoProfile([], "unknown").pin, /current card PIN/);
  assert.doesNotMatch(describeDemoProfile([], "unknown").pin, /2468|1037/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { accountCard } from "../js/components/accounts.js";
import { profileDetails, renderUserProfile } from "../js/components/user-profile.js";
import { table } from "../js/components/ui.js";

test("server-derived profiles show correct names and uppercase initials", () => {
  const profiles = [
    { firstName: "Gospelhope", lastName: "David", initials: "GD" },
    { firstName: "Cheng-Yang", lastName: "Lee", initials: "CL" },
    { firstName: "Mingyu", lastName: "Fan", initials: "MF" },
  ];
  for (const profile of profiles) {
    const details = profileDetails(profile);
    assert.equal(details.initials, profile.initials);
    assert.equal(details.name, `${profile.firstName} ${profile.lastName}`);
  }
});

test("account API IDs, balances and pending state render into the correct card", () => {
  const account = {
    id: "b7421870-6d43-4ab6-9324-31b9f6a20a51", name: "Everyday checking", suffix: "4821",
    type: "checking", balance: 9888.24, status: "active",
  };
  const output = accountCard(account);
  assert.match(output, /data-account="b7421870-6d43-4ab6-9324-31b9f6a20a51"/);
  assert.match(output, /\$9,888\.24/);
  assert.match(output, /Current balance/);
  assert.match(accountCard({ ...account, type: "loan", status: "pending" }),
    /Application received/);
});

test("database text is escaped when inserted in profile and transaction HTML", () => {
  const target = { setAttribute() {}, innerHTML: "" };
  renderUserProfile(target, { name: '<img src=x onerror="attack()">' });
  assert.ok(!target.innerHTML.includes("<img"));
  const output = table([{
    id: "1d87d8fb-28d4-4f5f-992a-823326f6c74a", accountId: "67b58ac3-7b97-4f3b-8c0b-3146e48719d7", name: "<script>attack()</script>",
    category: "Dining", date: "2026-10-02", amount: -12.50, icon: "<img>",
  }]);
  assert.ok(!output.includes("<script>"));
  assert.match(output, /\$12\.50/);
  assert.match(output, /&lt;script&gt;/);
});

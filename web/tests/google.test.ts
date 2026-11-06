// Signing in with Google: a Google account becomes a Daak identity without exposing the account itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { googleUid } from "../lib/google.ts";

test("the same Google account always maps to the same Daak person, and different accounts differ", () => {
  assert.equal(googleUid("1170000000001"), googleUid("1170000000001"));
  assert.notEqual(googleUid("1170000000001"), googleUid("1170000000002"));
});

test("a Google person's id says it is Google, and does not contain the account id", () => {
  const uid = googleUid("1170000000001");
  assert.match(uid, /^g:[0-9a-f]{20}$/);
  assert.ok(!uid.includes("1170000000001"));
});

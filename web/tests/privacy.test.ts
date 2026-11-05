// Private details must be unreadable in the public record and must not survive tampering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seal, unseal } from "../lib/swarm.ts";
import { badgeHash } from "../lib/history.ts";

// The key is read when sealing, so a test secret set here is used.
process.env.DAAK_MASTER_SECRET = "test-secret-not-real";

test("a sealed phone and UPI ID opens back to the same text, and the sealed form does not contain it", () => {
  const text = JSON.stringify({ phone: "9876543210", upi: "ramesh@okaxis" });
  const sealed = seal(text, "person");
  assert.ok(!sealed.includes("9876543210") && !sealed.includes("ramesh"));
  assert.equal(unseal(sealed, "person"), text);
});

test("a sealed value cannot be opened with another purpose's key or after tampering", () => {
  const sealed = seal("secret", "person");
  assert.throws(() => unseal(sealed, "swarm-ref"));
  const b = Buffer.from(sealed, "base64");
  b[b.length - 1] ^= 1;
  assert.throws(() => unseal(b.toString("base64"), "person"));
});

test("a badge appears on the public log only as a stable 12-character hash", () => {
  const h = badgeHash("04:23:9b:52:1d:1c:91");
  assert.match(h, /^[0-9a-f]{12}$/);
  assert.equal(h, badgeHash("04:23:9b:52:1d:1c:91"));
  assert.notEqual(h, badgeHash("04:23:9b:52:1d:1c:92"));
});

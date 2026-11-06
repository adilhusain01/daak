// A driver who taps a person's badge where the parcel should go was told "This parcel is not booked yet" (7 Nov audit).
// When the tapped tag is a badge, the phone is told whose it is so it can say "tap the parcel first".
import { test } from "node:test";
import assert from "node:assert/strict";
import { tappedPerson } from "../lib/rules.ts";

test("a tapped badge comes back as its holder's first name and role", () => {
  assert.deepEqual(tappedPerson({ name: "Suresh Kumar, Gorakhpur", role: "driver" }), { name: "Suresh Kumar", role: "driver" });
});

test("a tag that is no one's badge comes back as nothing", () => {
  assert.equal(tappedPerson(null), null);
});

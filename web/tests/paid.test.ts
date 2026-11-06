// A shop's parcel list showed the drivers' meter (Rs 184.50) for a booking it paid Rs 206.64 for (KNP-GW5Y2, 7 Nov).
// What the shop paid is the meter plus Daak's booking fee, the same total x402 charged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paidFor } from "../lib/network.ts";

test("what the shop paid is the meter plus the booking fee, as charged on 7 Nov", () => {
  assert.equal(paidFor(184.5), 206.64);   // KNP-GW5Y2
  assert.equal(paidFor(535.05), 599.26);  // KNP-3WAE9
});

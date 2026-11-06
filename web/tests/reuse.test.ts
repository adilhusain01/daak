// A parcel sticker can carry a new booking once its last one is delivered (shops reuse tags), never while it is still
// on the road: two live bookings on one sticker would send a driver's tap to the wrong parcel (7 Nov).
import { test } from "node:test";
import assert from "node:assert/strict";
import { openLeg } from "../lib/rules.ts";

const route = [{ hop: 1 }, { hop: 2 }, { hop: 3 }];

test("the open stop is the first one not yet handed over; a held handover leaves it open", () => {
  assert.equal(openLeg(route, [])?.hop, 1);
  assert.equal(openLeg(route, [{ hop: 1, verdict: "green" }, { hop: 2, verdict: "held" }])?.hop, 2);
  assert.equal(openLeg(route, [{ hop: 1, verdict: "green" }, { hop: 2, verdict: "unchecked" }])?.hop, 3);
});

test("when every stop is handed over there is no open stop, so the sticker is free for a new booking", () => {
  assert.equal(openLeg(route, [{ hop: 1, verdict: "green" }, { hop: 2, verdict: "green" }, { hop: 3, verdict: "green" }]), undefined);
});

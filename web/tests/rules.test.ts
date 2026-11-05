// What Daak's rules must do, written from the product rules, not from the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitByKm, bachatUnits, advanceFor } from "../lib/rules.ts";
import { meterFee, pathBetween } from "../lib/network.ts";

test("the meter charges Rs 5 plus Rs 0.50 a km", () => {
  assert.equal(meterFee(350), 180);
  assert.equal(meterFee(80), 45);
  assert.equal(meterFee(0), 5);
});

test("a fee is split by kilometres and the parts add up to the fee exactly", () => {
  const s = splitByKm(18000, [{ badge: "A", km: 80 }, { badge: "B", km: 270 }]);
  assert.deepEqual(s.map((x) => x.units), [4114, 13886]);
  assert.equal(s.reduce((a, x) => a + x.units, 0), 18000);
  const odd = splitByKm(100, [{ badge: "A", km: 1 }, { badge: "B", km: 1 }, { badge: "C", km: 1 }]);
  assert.equal(odd.reduce((a, x) => a + x.units, 0), 100);
});

test("a stretch of 0 km earns nothing and no legs means no payout", () => {
  assert.deepEqual(splitByKm(18000, []), []);
  assert.deepEqual(splitByKm(18000, [{ badge: "shop", km: 0 }]), []);
});

test("Bachat keeps the chosen percent, rounded down, and never more than 20%", () => {
  assert.equal(bachatUnits(4032, 5), 201);
  assert.equal(bachatUnits(4032, 0), 0);
  assert.equal(bachatUnits(1000, 50), 200);
  assert.equal(bachatUnits(1000, -5), 0);
});

test("a fuel advance needs two proven deliveries, no recent hold and a 90% clean record", () => {
  assert.equal(advanceFor({ proven: 1, heldRecently: false, cleanRate: 1, earned30dRupees: 10000 }).eligibleRupees, 0);
  assert.equal(advanceFor({ proven: 5, heldRecently: true, cleanRate: 1, earned30dRupees: 10000 }).eligibleRupees, 0);
  assert.equal(advanceFor({ proven: 5, heldRecently: false, cleanRate: 0.8, earned30dRupees: 10000 }).eligibleRupees, 0);
});

test("a fuel advance is 25% of the last 30 days, rounded down to Rs 10, capped at Rs 5,000", () => {
  assert.equal(advanceFor({ proven: 2, heldRecently: false, cleanRate: 1, earned30dRupees: 80.62 }).eligibleRupees, 20);
  assert.equal(advanceFor({ proven: 9, heldRecently: false, cleanRate: 0.95, earned30dRupees: 8000 }).eligibleRupees, 2000);
  assert.equal(advanceFor({ proven: 90, heldRecently: false, cleanRate: 1, earned30dRupees: 100000 }).eligibleRupees, 5000);
});

test("the route from Kanpur to Gorakhpur runs through Lucknow, and there is no route backwards yet", () => {
  assert.deepEqual(pathBetween("KNP", "GKP").map((l) => l.id), ["KNP-LKO", "LKO-GKP"]);
  assert.deepEqual(pathBetween("LKO", "GKP").map((l) => l.id), ["LKO-GKP"]);
  assert.deepEqual(pathBetween("GKP", "KNP"), []);
});

test("Daak's booking fee is 12% of the meter, at least Rs 5", async () => {
  const { bookingFee } = await import("../lib/network.ts");
  assert.equal(bookingFee(180), 21.6);
  assert.equal(bookingFee(80), 9.6);
  assert.equal(bookingFee(20), 5);
});

test("a new driver gets 50% at handover, a proven one 70%, a trusted one 90%", async () => {
  const { tierFor } = await import("../lib/rules.ts");
  assert.equal(tierFor({ proven: 2, cleanRate: 1, heldRecently: false }).advancePct, 50);
  assert.equal(tierFor({ proven: 12, cleanRate: 0.9, heldRecently: false }).advancePct, 70);
  assert.equal(tierFor({ proven: 60, cleanRate: 0.99, heldRecently: false }).advancePct, 90);
});

test("a recent held handoff drops a driver back to 50% at handover", async () => {
  const { tierFor } = await import("../lib/rules.ts");
  assert.equal(tierFor({ proven: 60, cleanRate: 0.99, heldRecently: true }).advancePct, 50);
});

test("the advance and the holdback add up to the leg's pay exactly", async () => {
  const { splitAdvance } = await import("../lib/rules.ts");
  const s = splitAdvance(4114, 50);
  assert.equal(s.advance + s.holdback, 4114);
  assert.deepEqual(splitAdvance(13886, 70), { advance: 9720, holdback: 4166 });
});

test("the pool tops up a refund to the declared value, capped, after the liable driver's holdback", async () => {
  const { poolPayout } = await import("../lib/rules.ts");
  assert.equal(poolPayout(1500, 69.43, 2000), 1430.57);
  assert.equal(poolPayout(5000, 100, 2000), 1900);
  assert.equal(poolPayout(0, 100, 2000), 0);
});

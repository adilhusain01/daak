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

test("the meter charges each stretch's road distance, the same one the map draws", async () => {
  const { readFileSync } = await import("node:fs");
  const { network } = await import("../lib/network.ts");
  const roads = JSON.parse(readFileSync("public/map/india.json", "utf8")).roads as Record<string, { km: number }>;
  for (const l of network().legs) assert.equal(l.km, roads[l.id].km, `${l.id} charges ${l.km} km, road is ${roads[l.id].km} km`);
});

test("a standing order is due on its weekdays in India time, once a day", async () => {
  const { standingDue, istDate } = await import("../lib/rules.ts");
  // Friday 6 Nov 2026, 04:00 IST is Thursday 22:30 UTC: the day that counts is India's.
  const fri4am = new Date("2026-11-05T22:30:00Z");
  assert.equal(istDate(fri4am), "2026-11-06");
  assert.equal(standingDue({ days: "1111100", lastRun: "" }, fri4am), true); // Mon to Fri
  assert.equal(standingDue({ days: "1111000", lastRun: "" }, fri4am), false); // Mon to Thu
  assert.equal(standingDue({ days: "1111100", lastRun: "2026-11-06" }, fri4am), false); // already booked today
  assert.equal(standingDue({ days: "0000011", lastRun: "" }, new Date("2026-11-07T03:00:00Z")), true); // Saturday
});

test("weight bands multiply the meter: x1 up to 5 kg, x1.5 to 15, x2 to 30, x3 to 50", async () => {
  const { meterFee, bandFor } = await import("../lib/network.ts");
  assert.equal(meterFee(359), 184.5); // no band given: the lightest
  assert.equal(meterFee(359, "s"), 184.5);
  assert.equal(meterFee(359, "m"), 276.75);
  assert.equal(meterFee(359, "l"), 369);
  assert.equal(meterFee(359, "xl"), 553.5);
  assert.equal(bandFor(4)?.id, "s");
  assert.equal(bandFor(5)?.id, "s");
  assert.equal(bandFor(12)?.id, "m");
  assert.equal(bandFor(30)?.id, "l");
  assert.equal(bandFor(50)?.id, "xl");
  assert.equal(bandFor(51), null); // too heavy for a bus parcel
});

test("an unknown weight band is refused, never priced as the lightest", async () => {
  const { meterFee } = await import("../lib/network.ts");
  assert.throws(() => meterFee(100, "huge"));
});

test("the next departure is today's bus if it has not left, else the next day it runs", async () => {
  const { nextDeparture } = await import("../lib/timetable.ts");
  const fri5am = new Date("2026-11-06T05:00:00+05:30");
  assert.equal(nextDeparture({ dep: "06:30", days: "1111110" }, fri5am)?.toISOString(), new Date("2026-11-06T06:30:00+05:30").toISOString());
  const fri7am = new Date("2026-11-06T07:00:00+05:30");
  assert.equal(nextDeparture({ dep: "06:30", days: "1111110" }, fri7am)?.toISOString(), new Date("2026-11-07T06:30:00+05:30").toISOString());
  // Saturday 7 am: no bus on Sunday, so Monday.
  assert.equal(nextDeparture({ dep: "06:30", days: "1111110" }, new Date("2026-11-07T07:00:00+05:30"))?.toISOString(), new Date("2026-11-09T06:30:00+05:30").toISOString());
  // The driver marked Friday as a day off.
  assert.equal(nextDeparture({ dep: "06:30", days: "1111110" }, fri5am, ["2026-11-06"])?.toISOString(), new Date("2026-11-07T06:30:00+05:30").toISOString());
  assert.equal(nextDeparture({ dep: "06:30", days: "0000000" }, fri5am), null);
});

test("a plan only chains buses that connect, with time to change at the stand", async () => {
  const { planStretches } = await import("../lib/timetable.ts");
  const at = new Date("2026-11-06T05:00:00+05:30");
  const plan = planStretches([
    { km: 80, candidates: [{ uid: "A", tt: { dep: "06:30", days: "1111111" } }] },                // reaches Lucknow 08:30
    { km: 120, candidates: [{ uid: "B", tt: { dep: "08:40", days: "1111111" } }, { uid: "C", tt: { dep: "09:30", days: "1111111" } }] },
  ], at);
  assert.equal(plan[0].options[0].uid, "A");
  assert.equal(plan[0].options[0].arr?.toISOString(), new Date("2026-11-06T08:30:00+05:30").toISOString());
  // B leaves 10 minutes after A arrives, too tight for the 20-minute change, so tomorrow; C connects today.
  assert.equal(plan[1].options[0].uid, "C");
  assert.equal(plan[1].options[0].arr?.toISOString(), new Date("2026-11-06T12:30:00+05:30").toISOString());
  assert.equal(plan[1].options[1].uid, "B");
});

test("drivers without bus times stay bookable, after those with times, with no ETA", async () => {
  const { planStretches } = await import("../lib/timetable.ts");
  const plan = planStretches([{ km: 80, candidates: [{ uid: "X", tt: null }, { uid: "A", tt: { dep: "06:30", days: "1111111" } }] }], new Date("2026-11-06T05:00:00+05:30"));
  assert.deepEqual(plan[0].options.map((o) => o.uid), ["A", "X"]);
  assert.equal(plan[0].options[1].dep, null);
});

test("an HCS-14 UAID is deterministic, normalised, and ignores nothing it should hash", async () => {
  const { uaid, verifyUaid } = await import("../lib/uaid.ts");
  const a = { registry: "Daak ", name: "Daak booking", version: "1", protocol: "X402", nativeId: "hedera:testnet:0.0.11325722", skills: [17, 0] };
  const id = uaid(a);
  assert.match(id, /^uaid:aid:[1-9A-HJ-NP-Za-km-z]+;uid=0;registry=daak;proto=x402;nativeId=hedera:testnet:0\.0\.11325722$/);
  assert.equal(uaid({ ...a, registry: "daak", protocol: "x402", skills: [0, 17] }), id); // case and order do not matter
  assert.notEqual(uaid({ ...a, nativeId: "hedera:testnet:0.0.1" }), id); // a different account is a different agent
  assert.equal(verifyUaid(id, a), true);
  assert.throws(() => uaid({ ...a, skills: [50] }));
});

test("UAIDs match Hashgraph Online's reference SDK byte for byte", async () => {
  const { uaid } = await import("../lib/uaid.ts");
  // Expected values produced by @hashgraphonline/standards-sdk 0.1.192, HCS14Client.createUaid(data, { uid, proto }).
  assert.equal(uaid({ registry: "daak", name: "Daak booking", version: "1", protocol: "x402", nativeId: "hedera:testnet:0.0.11325722", skills: [] }, "0"),
    "uaid:aid:523zLFUo5BZwGPAisoPoqfMe8KozkL9SPrW9ftvNBpNmDT9BJ3WCVBd7vXBLoRQ525;uid=0;registry=daak;proto=x402;nativeId=hedera:testnet:0.0.11325722");
  assert.equal(uaid({ registry: "acme", name: "Support", version: "1.0.0", protocol: "a2a", nativeId: "acme.example", skills: [17, 0] }, "support"),
    "uaid:aid:6tBGtdYtv1buF76s9QLtSZjQfTpqheRXxdktpXZqszjNJiNgvHoeNdwAMpPy6zE2uu;uid=support;registry=acme;proto=a2a;nativeId=acme.example");
});

test("the backup check can only make a handoff safer: a problem holds it, a pass still waits for 0G", async () => {
  delete process.env.BACKUP_PAYS;
  const { backupVerdict } = await import("../lib/backup.ts");
  const ok = { match: true, codeRead: "KNP-1", condition: "intact" as const, reason: "", model: "m", provider: "gemini" as const };
  assert.equal(backupVerdict(ok, true, true), "unchecked");
  assert.equal(backupVerdict({ ...ok, match: false }, true, true), "held");
  assert.equal(backupVerdict({ ...ok, condition: "damaged" }, true, true), "held");
  assert.equal(backupVerdict({ ...ok, condition: "opened" }, true, true), "held");
  assert.equal(backupVerdict(ok, false, true), "held");
  assert.equal(backupVerdict(ok, true, false), "held");
});

test("a parcel between stops is placed along the road by the bus's time, clamped to the stretch", async () => {
  const { pointAlong, parcelPosition } = await import("../lib/path.ts");
  const line: [number, number][] = [[80, 26], [81, 26], [82, 26]]; // lng, lat: two equal pieces
  assert.deepEqual(pointAlong(line, 0), [80, 26]);
  assert.deepEqual(pointAlong(line, 0.5), [81, 26]);
  assert.deepEqual(pointAlong(line, 0.75), [81.5, 26]);
  assert.deepEqual(pointAlong(line, 2), [82, 26]);
  const legs = [
    { hop: 1, km: 0, coords: [] as [number, number][], stop: [80, 26] as [number, number] },
    { hop: 2, km: 80, coords: line, stop: [82, 26] as [number, number], departsAt: 1000, etaAt: 3000 },
  ];
  assert.deepEqual(parcelPosition(legs, new Set([1]), 2000), { at: [81, 26], kind: "moving", hop: 2 });  // halfway in time
  assert.deepEqual(parcelPosition(legs, new Set([1]), 500), { at: [80, 26], kind: "waiting", hop: 2 });  // bus not left yet
  assert.deepEqual(parcelPosition(legs, new Set(), 2000), { at: [80, 26], kind: "waiting", hop: 1 });   // not picked up
  assert.deepEqual(parcelPosition(legs, new Set([1, 2]), 2000), { at: [82, 26], kind: "arrived", hop: 2 });
});

test("the stand check holds a handoff far from the stand, caps the claimed GPS accuracy, and can be turned off", async () => {
  const { placeCheck } = await import("../lib/rules.ts");
  const stand = { lat: 26.8327, lng: 80.9202 }; // Charbagh, Lucknow
  assert.equal(placeCheck({ lat: 26.8329, lng: 80.9204, acc: 10 }, stand, 500).ok, true);   // about 30 m away
  assert.equal(placeCheck({ lat: 19.0596, lng: 72.8295, acc: 10 }, stand, 500).ok, false);  // Mumbai
  assert.equal(placeCheck({ lat: 26.8427, lng: 80.9202, acc: 5000 }, stand, 500).ok, false); // 1.1 km, a huge claimed accuracy is capped at 200 m
  assert.equal(placeCheck(null, stand, 500).ok, false);                                       // no fix while the check is on
  assert.equal(placeCheck({ lat: 19.0596, lng: 72.8295, acc: 10 }, stand, 0).ok, true);    // check off
  assert.equal(placeCheck(null, null, 500).ok, true);                                         // stand has no coordinates
});

// The 0G reading of a driver's ID, compared with what the driver claimed when joining.
import { compareId } from "../lib/rules.ts";

test("an ID read by 0G matches when the type, the name and the last 4 agree", () => {
  const r = compareId({ docType: "dl", name: "ADIL HUSAIN", last4: "4821", vehicleClasses: "LMV, TRANS", masked: false, edited: false }, { idType: "dl", name: "Adil Husain", last4: "4821" });
  assert.deepEqual(r, { typeOk: true, nameOk: true, last4Ok: true, busOk: true, maskOk: null, editedOk: true });
});

test("a different name, wrong last 4 or a car-only licence is flagged", () => {
  const r = compareId({ docType: "dl", name: "RAJESH KUMAR", last4: "1111", vehicleClasses: "MCWG, LMV", masked: false, edited: false }, { idType: "dl", name: "Adil Husain", last4: "4821" });
  assert.equal(r.nameOk, false);
  assert.equal(r.last4Ok, false);
  assert.equal(r.busOk, false);
});

test("an Aadhaar must be masked, and an edited-looking photo is flagged", () => {
  const r = compareId({ docType: "aadhaar_masked", name: "Ramesh Yadav", last4: "9012", vehicleClasses: "", masked: false, edited: true }, { idType: "aadhaar_masked", name: "Ramesh", last4: "9012" });
  assert.equal(r.maskOk, false);
  assert.equal(r.editedOk, false);
  assert.equal(r.busOk, null);
});

// Vouching puts the voucher's own standing on the line, and nobody can vouch in bulk.
import { vouchStanding } from "../lib/rules.ts";

const day = 86_400_000, T = 1793950000000;
const vouch = (by: string, who: string, ts: number) => ({ t: "daak.vouched", by, who, ts });

test("a voucher can vouch for three people in 30 days, not four", () => {
  const log = [vouch("v1", "a", T - 2 * day), vouch("v1", "b", T - 3 * day), vouch("v1", "c", T - 4 * day)];
  assert.deepEqual(vouchStanding(log, "v1", T), { ok: false, why: "You have vouched for 3 people in the last 30 days. Wait before vouching again." });
  assert.deepEqual(vouchStanding([...log.slice(0, 2), vouch("v1", "c", T - 40 * day)], "v1", T), { ok: true, left: 1 });
});

test("if someone you vouched for is found responsible for a damaged parcel, you cannot vouch for 90 days", () => {
  const log = [
    vouch("v1", "d1", T - 50 * day),
    { t: "daak.handoff", code: "KNP-1", hop: 2, from: "d1", to: "d2", ts: T - 20 * day },
    { t: "daak.refunded", code: "KNP-1", liableHop: 2, ts: T - 19 * day },
  ];
  assert.equal(vouchStanding(log, "v1", T).ok, false);
  assert.equal(vouchStanding(log, "v1", T + 80 * day).ok, true);
  assert.equal(vouchStanding(log, "someone-else", T).ok, true);
});

// The agent pays for its own sealed checks: after bookings it tops up its 0G compute account, within a daily cap.
import { topUpPlan } from "../lib/rules.ts";

test("the compute account is topped up only when it runs low, and never past the daily cap", () => {
  const base = { available: 2, providerLocked: 1, wallet: 6, toppedToday: 0 };
  assert.deepEqual(topUpPlan(base), { deposit: 0, toProvider: 0 });
  assert.deepEqual(topUpPlan({ ...base, available: 0.5 }), { deposit: 0.25, toProvider: 0 });
  assert.deepEqual(topUpPlan({ ...base, available: 0.5, toppedToday: 1 }), { deposit: 0, toProvider: 0 });
});

test("the provider's share is refilled from the account, and the wallet always keeps gas", () => {
  assert.deepEqual(topUpPlan({ available: 2, providerLocked: 0.3, wallet: 6, toppedToday: 0 }), { deposit: 0, toProvider: 1 });
  assert.deepEqual(topUpPlan({ available: 0.5, providerLocked: 1, wallet: 0.2, toppedToday: 0 }), { deposit: 0, toProvider: 0 });
});

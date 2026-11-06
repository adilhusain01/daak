// Driver 2's stop on KNP-3WAE9 was held because 0G misread the lid, then rechecked green (HCS seq 108). His Earnings
// tab still said 0 proven, 0 km and "10 clean handovers in a row lift you back up" (7 Nov audit): a recheck that
// clears a handover must count as that handover's verdict on the driver's record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterRechecks } from "../lib/rules.ts";

const held = { t: "daak.handoff", code: "KNP-3WAE9", hop: 3, from: "d2", verdict: "held", ts: 1 };

test("a held handover that a recheck cleared counts as green", () => {
  const log = [held, { t: "daak.recheck", code: "KNP-3WAE9", hop: 3, verdict: "green", ts: 2 }];
  const out = afterRechecks(log).filter((m) => m.t === "daak.handoff");
  assert.equal(out.length, 1);
  assert.equal(out[0].verdict, "green");
  assert.equal(out[0].from, "d2");
});

test("a held handover with no recheck, or a recheck of another stop, stays held", () => {
  assert.equal(afterRechecks([held])[0].verdict, "held");
  const other = afterRechecks([held, { t: "daak.recheck", code: "KNP-3WAE9", hop: 2, verdict: "green", ts: 2 }]);
  assert.equal(other[0].verdict, "held");
});

test("the latest recheck of a stop decides", () => {
  const log = [held,
    { t: "daak.recheck", code: "KNP-3WAE9", hop: 3, verdict: "green", ts: 2 },
    { t: "daak.recheck", code: "KNP-3WAE9", hop: 3, verdict: "held", ts: 3 }];
  assert.equal(afterRechecks(log)[0].verdict, "held");
});

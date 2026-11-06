// Read-only: how many of each Daak record Arkiv holds right now, and the people by role. Prints names and roles only.
import { badgesByRole, allConsignments, allVerdicts, standingOrders } from "../lib/arkiv";

const roles = ["sender", "driver", "receiver"];
for (const r of roles) {
  const b = await badgesByRole(r);
  console.log(`${r}: ${b.length}`, b.map((x) => x.name).join(", "));
}
const c = await allConsignments();
console.log(`bookings: ${c.length}`, c.slice(0, 40).map((x) => x.code).join(" "));
console.log(`handoff verdicts (live, not expired): ${(await allVerdicts()).length}`);
console.log(`daily orders: ${(await standingOrders()).length}`);

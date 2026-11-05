// A query anyone can run against Daak's public record on Arkiv, no keys needed:
//   cd web && npx tsx scripts/arkiv-query.mts
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { defineSchema, i32, str, u64, bytes } from "@arkiv-network/sdk/schema";
import { desc, eq } from "@arkiv-network/sdk/query";
import { http } from "viem";

const DAAK = "0x610FdB41DA83138615C317c89fd9EB09271a46fe"; // the wallet that writes every Daak entity

const Badges = defineSchema("daak.badge", { uid: str().indexed(), name: str(), role: str().indexed(), vehicle: str(), legs: str().optional(), kycStatus: str().optional() });
const Consignments = defineSchema("daak.consignment", {
  code: str().indexed(), parcel: str().indexed(), label: str(), route: bytes(), feeRupees: i32(), createdAt: u64().indexed(),
  feePaise: i32().optional(), weight: str().optional(),
});

// Your own free key from hub.arkiv.network/access-keys if you have one; "" uses the public, rate-limited endpoint.
const client = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" }), transport: http() });

const drivers = await client.select({ name: true, vehicle: true, legs: true, kycStatus: true }).from(Badges)
  .where(eq("role", "driver")).ownedBy(DAAK).limit(20).fetch();
console.log("Drivers on Daak:");
for (const d of drivers.entities) console.log(`  ${d.name.value} · ${d.vehicle.value} · runs ${d.legs?.value} · ID ${d.kycStatus?.value || "not checked"}`);

const latest = await client.select({ $key: true, code: true, label: true, feeRupees: true, feePaise: true, weight: true, createdAt: true }).from(Consignments)
  .ownedBy(DAAK).orderBy(desc("createdAt")).limit(5).fetch();
console.log("\nLatest bookings:");
for (const c of latest.entities) {
  const fee = c.feePaise?.value ? Number(c.feePaise.value) / 100 : Number(c.feeRupees.value);
  console.log(`  ${c.code.value} · ${c.label.value} · Rs ${fee} · band ${c.weight?.value || "s"} · ${new Date(Number(c.createdAt.value)).toISOString()} · entity ${String(c.$key)}`);
}

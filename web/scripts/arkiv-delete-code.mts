// Deletes one booking and its handoffs from Arkiv by code, for a ghost left by a failed booking.
// Dry run by default: it lists what it would delete. Pass --yes to delete. Deleting an Arkiv entity is permanent;
// the booking's lines on the Hedera log stay, by design.
//   npx tsx --env-file=.env.local scripts/arkiv-delete-code.mts KNP-XXXXX [--yes]
import { arkivRead, arkivWrite, owner, Consignments, Handoffs } from "../lib/arkiv";
import { eq } from "@arkiv-network/sdk/query";

const code = process.argv[2];
const go = process.argv.includes("--yes");
if (!code || !/^[A-Z]{3}-[A-Z0-9]{4,6}$/.test(code)) { console.error("Give a booking code, like KNP-472TU"); process.exit(1); }

const found: { key: `0x${string}`; what: string }[] = [];
for (const [what, schema] of [["booking", Consignments], ["handoff", Handoffs]] as const) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = await (arkivRead() as any).select({ $key: true, code: true }).from(schema).where(eq("code", code)).ownedBy(owner()).limit(50).fetch();
  for (const e of r.entities) found.push({ key: String(e.$key) as `0x${string}`, what });
}
console.log(`${code}: ${found.map((f) => f.what).join(", ") || "nothing"} ${go ? "deleting" : "found"}`);
if (!go) { console.log("dry run: pass --yes to delete"); process.exit(0); }
for (const f of found) { await arkivWrite().deleteEntity({ entityKey: f.key }); console.log(`deleted ${f.what} ${f.key}`); }

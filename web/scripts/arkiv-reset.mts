// Clears Daak's Arkiv records for a fresh demo run, keeping one booking (and its handoffs) as the public showcase.
// Dry run by default: it lists what it would delete. Pass --yes to delete. Deleting an Arkiv entity is permanent.
//   npx tsx --env-file=.env.local scripts/arkiv-reset.mts [--keep KNP-3WAE9] [--yes]
// The Hedera log is not touched: it is public and permanent by design.
import { arkivRead, arkivWrite, owner, Badges, Consignments, Handoffs, Prefs, StandingOrders } from "../lib/arkiv";

const args = process.argv.slice(2);
const keep = args.includes("--keep") ? args[args.indexOf("--keep") + 1] : "KNP-3WAE9";
const go = args.includes("--yes");

type Item = { key: `0x${string}`; what: string };
const all = async (schema: typeof Badges | typeof Consignments | typeof Handoffs | typeof Prefs | typeof StandingOrders, label: (e: Record<string, { value: unknown }>) => string, skip: (e: Record<string, { value: unknown }>) => boolean) => {
  const out: Item[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await (arkivRead() as any).select({ $key: true, ...(schema === Consignments || schema === Handoffs ? { code: true } : {}), ...(schema === Badges ? { name: true, role: true } : {}) })
      .from(schema).ownedBy(owner()).limit(100).offset(offset).fetch();
    for (const e of r.entities) if (!skip(e)) out.push({ key: String(e.$key) as `0x${string}`, what: label(e) });
    if (r.entities.length + (r.skipped ?? 0) < 100) break;
  }
  return out;
};

const items: Item[] = [
  ...(await all(Badges, (e) => `person ${e.name?.value} (${e.role?.value})`, () => false)),
  ...(await all(Consignments, (e) => `booking ${e.code?.value}`, (e) => e.code?.value === keep)),
  ...(await all(Handoffs, (e) => `handoff ${e.code?.value}`, (e) => e.code?.value === keep)),
  ...(await all(Prefs, () => "driver preference", () => false)),
  ...(await all(StandingOrders, () => "daily order", () => false)),
];
const tally = items.reduce<Record<string, number>>((t, i) => { const k = i.what.split(" ")[0]; t[k] = (t[k] ?? 0) + 1; return t; }, {});
console.log(`keeping ${keep} and its handoffs; ${go ? "deleting" : "would delete"}:`, JSON.stringify(tally));
console.log(items.filter((i) => i.what.startsWith("person")).map((i) => i.what).join("; "));
if (!go) { console.log("dry run: pass --yes to delete"); process.exit(0); }

let done = 0, failed = 0;
for (const i of items) {
  try { await arkivWrite().deleteEntity({ entityKey: i.key }); done++; }
  catch (e) { failed++; console.error(`could not delete ${i.what}: ${(e as Error).message.slice(0, 120)}`); }
}
console.log(`deleted ${done}, failed ${failed}`);

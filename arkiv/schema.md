# Arkiv schema

Every entity is written by the Daak operator wallet `0x610FdB41DA83138615C317c89fd9EB09271a46fe` on Rabdi (chain 7794095) with `@arkiv-network/sdk` 1.0.1, through typed schemas in `web/lib/arkiv.ts`.

| Schema | Columns (indexed in bold) | Lifetime | Written when | Read by |
|---|---|---|---|---|
| `daak.consignment` | **code**, **parcel**, label, route (bytes: JSON legs with km), feeRupees, **createdAt**, schedule (optional) | 30 days | a booking is paid over x402 | handoff API (find the parcel's booking), tracking page, dashboard |
| `daak.handoff` | **code**, **hop**, **verdict**, place, fromBadge, toBadge, **at**, zgRequestId, hcs, photoSha256, reason (bytes), geo (optional) | 1 day | every handoff | tracking page, dashboard, the next handoff (which hops are done) |
| `daak.badge` | **uid**, name, **role**, vehicle | 30 days | a driver, shop or retailer badge is registered | driver screen |
| `daak.pref` | **uid**, savePercent, **at** | 30 days | a driver turns Bachat on or off | payout (how much goes to Bachat), driver screen |

Badges appear in handoffs only as a 12-character SHA-256 prefix, never as the raw NFC serial.

## A runnable query

```ts
import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { defineSchema, i32, str, u64, bytes } from "@arkiv-network/sdk/schema";
import { eq } from "@arkiv-network/sdk/query";
import { http } from "viem";

const Handoffs = defineSchema("daak.handoff", {
  code: str().indexed(), hop: i32().indexed(), verdict: str().indexed(), place: str(),
  fromBadge: str(), toBadge: str(), at: u64().indexed(), zgRequestId: str(), hcs: str(),
  photoSha256: str(), reason: bytes(), geo: str().optional(),
});

const client = createPublicClient({ chain: rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY! }), transport: http() });
const page = await client
  .select({ $key: true, hop: true, verdict: true, place: true, hcs: true })
  .from(Handoffs)
  .where(eq("code", "KNP-6377"))
  .ownedBy("0x610FdB41DA83138615C317c89fd9EB09271a46fe")
  .limit(10)
  .fetch();
console.log(page.entities.map((e) => [e.hop.value, e.verdict.value, e.place.value, e.hcs.value]));
```

Handoffs expire after a day, so query a consignment booked in the last 24 hours (the dashboard lists them).

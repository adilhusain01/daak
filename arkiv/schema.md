# Arkiv schema

Every entity is written by the Daak operator wallet `0x610FdB41DA83138615C317c89fd9EB09271a46fe` on Rabdi (chain 7794095) with `@arkiv-network/sdk` 1.0.1, through typed schemas in `web/lib/arkiv.ts`.

| Schema | Columns (indexed in bold) | Lifetime | Written when | Read by |
|---|---|---|---|---|
| `daak.badge` | **uid** (an NFC badge's hash input, or `g:` plus a hash of a Google account id), name, **role**, vehicle (plate and bus operator), legs (stretches a driver runs; the driver changes them from the app, signed by their phone), stop (a shop's bus stand), private (bytes: phone, UPI ID and, for Google sign-ins, email, sealed), devicePub (the phone's P-256 public key), kyc (bytes: ID type, last 4, sealed Swarm reference of the ID photo, all sealed), kycStatus, timetable (bus times per stretch), away (days off) | 30 days | a person joins from the app; a phone registers its key; the operator verifies an ID | sign-in, route planning (which drivers run a stretch), the drivers page, handoff signature checks, payouts (the sealed UPI ID), the ID review on the dashboard |
| `daak.consignment` | **code**, **parcel**, label, route (bytes: JSON legs with km and each driver's share at handover), feeRupees, feePaise, weight (a band id, or `kg:<charged kg>|<LxWxH>` for a measured parcel), **createdAt**, schedule (older bookings) | 30 days | a booking is paid over x402; a daily order's parcel is attached (the `parcel` column is patched) | the handoff API (find the parcel's booking), tracking page, dashboard, the driver's to-do list, payouts |
| `daak.handoff` | **code**, **hop**, **verdict**, place, fromBadge, toBadge, **at**, zgRequestId, hcs, photoSha256, reason (bytes), geo, photo (bytes: sealed Swarm reference), zgLog (root hash of the decision record on 0G Storage) | 1 day | every handoff, and every 0G recheck | tracking page, dashboard, the next handoff (which hops are done), the to-do list |
| `daak.pref` | **uid**, savePercent, **at** | 30 days | a driver turns Bachat on or off | payouts (how much goes to Bachat), the driver's home |
| `daak.standing` | **id**, **sender**, receiver, drivers, days (Monday first, e.g. `1111110`), active, lastRun, lastCode, createdAt, weight | 30 days | a shop makes a booking daily; the 04:00 IST run books it; the operator pauses it | the morning run, the shop's home in the app, the dashboard |

Badges appear in handoffs and on the Hedera log only as a 12-character SHA-256 prefix, never as the raw NFC serial or the Google account. List pages read every consignment a page of 100 at a time and every handoff's verdict in one paged query (`allConsignments`, `allVerdicts`), then page the result on the server. Phone numbers, UPI IDs, ID details and Swarm references are sealed before they reach Arkiv.

## A runnable query (no keys needed)

```bash
cd web && npm install && npx tsx scripts/arkiv-query.mts
```

It reads Daak's drivers and its latest bookings from Rabdi through Arkiv's public endpoint (pass `ARKIV_ACCESS_KEY` for a faster one). The core of it:

```ts
const client = createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http() });
const latest = await client
  .select({ $key: true, code: true, label: true, feePaise: true, weight: true, createdAt: true })
  .from(Consignments)
  .ownedBy("0x610FdB41DA83138615C317c89fd9EB09271a46fe")
  .orderBy(desc("createdAt"))
  .limit(5)
  .fetch();
```

Handoffs expire after a day; badges, bookings and daily orders after 30 days.

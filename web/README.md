# Daak web

The Next.js 16 app behind Daak: the API the phone app and the shop's agent call, the operator dashboard, the public tracking, drivers and network pages. The project README one folder up explains what Daak is and how to run it.

- `app/api/`: booking over x402 (`book`), the shop's booking request (`pack`), handoffs (`handoff`), payouts and disputes (`review`, `recheck`, `resolve`, `upi`), daily orders (`standing`), joining, Google sign-in, vouching and ID checks (`join`, `google`, `vouch`, `kyc`, `kyc/[uid]/read`), paged parcel lists and pages (`consignments`, `live`, `parcels/[uid]`), and the other read endpoints for the app and the pages.
- `lib/`: one module per partner (`hedera.ts`, `payout.ts`, `split.ts`, `x402.ts`, `agent.ts`, `zg.ts`, `zgstore.ts`, `compute.ts`, `arkiv.ts`, `swarm.ts`), sign-in and signatures (`google.ts`, `signing.ts`, `auth.ts`), the parcel lists (`parcels.ts`), and the pure rules in `rules.ts` and `network.ts`, which the tests cover.
- `scripts/`: one-off setup (`setup-hedera.mts`, `setup-money.mts`, `zg-direct-setup.mts` for Daak's 0G compute account), checks (`zg-compute.mts` shows the account and runs one booking's compute share, `zg-check.mts` runs one sealed check on a photo) and `arkiv-query.mts`, a query anyone can run without keys.
- `tests/`: `npm test`.

```bash
cp .env.example .env.local   # names only; fill in your own values
npm install
npm run dev
```

# Daak web

The Next.js 16 app behind Daak: the API the phone app and the shop's agent call, the operator dashboard, the public tracking, drivers and network pages. The project README one folder up explains what Daak is and how to run it.

- `app/api/`: booking over x402 (`book`), the shop's booking request (`pack`), handoffs (`handoff`), payouts and disputes (`review`, `recheck`, `resolve`, `upi`), daily orders (`standing`), joining and ID checks (`join`, `kyc`), and the read endpoints for the app and the pages.
- `lib/`: one module per partner (`hedera.ts`, `payout.ts`, `split.ts`, `x402.ts`, `agent.ts`, `zg.ts`, `zgstore.ts`, `arkiv.ts`, `swarm.ts`) and the pure rules in `rules.ts` and `network.ts`, which the tests cover.
- `scripts/`: one-off setup (`setup-hedera.mts`, `setup-money.mts`, `setup-0g.mts`) and `arkiv-query.mts`, a query anyone can run without keys.
- `tests/`: `npm test`.

```bash
cp .env.example .env.local   # names only; fill in your own values
npm install
npm run dev
```

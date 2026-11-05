# Daak: tasks to submission

Submission closes Saturday 7 November, 09:00 IST. Judging 09:30 to 12:30.

## Blocked on others

- [ ] **0G credits and the 0G outage.** A poller watches the Daak 0G wallet (`0x575F8D53D5bE1d16d4c1eDb8D01C4B68A0D48901`). When credits land: open the compute account, run the first real sealed check, press "Recheck with 0G" on held handoffs.
- [ ] **NFC stickers** (Amazon, Friday 8 am to 12 pm). Each new sticker joins from the app as a person: a shop, a second driver, the receiving shop.

## The team

- [ ] Testnet USDC from faucet.circle.com (Hedera Testnet) to `0.0.11325722`, then switch `X402_ASSET` to `0.0.429274`.
- [ ] Each teammate commits their own part and can explain it to judges.
- [ ] Each teammate joins with their own badge and real UPI ID (the real ₹ UPI moment).
- [ ] One real conversation or 20-second clip with a bus parcel booking office or a sender.
- [ ] Real paid deliveries during the hackathon (see `docs/business.md`, "Traction before Saturday").
- [ ] Set `DATA_SINCE` in Vercel when the clean demo run starts.
- [ ] Set `HOLDBACK_HOURS=0.25` in Vercel for the demo, so judges see a holdback release itself within 15 minutes.

## Build (order agreed: split payout, map, standing orders, weight)

- [ ] When 0G works: the decision log on 0G Storage lands for real; the scanner pays for its own AI from a capped slice of each fee (0G "Agents That Pay for Themselves").
- [x] Split payout with a holdback: 50, 70 or 90% at the confirmed handover by record; holdbacks in one Hedera schedule that releases itself after `HOLDBACK_HOURS`; the liable leg repays the shop; protection pool from 1 point of the booking fee. Tested on testnet.
- [x] Bus number checked against the plate format, bus operator, and driver KYC (ID type, last 4, encrypted ID photo, operator verifies, decision on HCS).
- [ ] Weight in the meter: km and weight band.
- [ ] Standing orders: a sender's daily repeat booking on a fixed route.
- [x] Booking fee: 12% of the meter, at least ₹5, on top of the meter (configurable).
- [ ] The network map page: India Post offices (pincode directory) and UP bus depots and corridors, with Daak's live routes on top.
- [ ] Run and film a real three-hop delivery with the stickers.

## Story and submission

- [ ] The cinematic film (Friday afternoon), in the style of the reference short.
- [ ] The submission demo video: 2 to 4 minutes, at least 720p, not recorded on a phone, no AI voiceover, HashScan shown.
- [ ] The 4-minute live demo script and 3 to 4 slides (problem, demo, market and numbers, ask); rehearse with stickers and two phones.
- [ ] Submission form: description, partners (0G, Hedera, Arkiv), links.
- [ ] Final README pass: 0G proof or the outage write-up, the business numbers.

## Done

- [x] App: join, roles, booking with receiver and drivers, handoffs from either phone, signed on the phone, offline queue, Hindi first, My work, Bachat, fuel advance.
- [x] Web: landing page, operator dashboard behind a passcode, drivers marketplace, tracking page, disputes, UPI QR with UTR on chain.
- [x] Chain: x402 booking on Hedera, dINR with a 2% custom fee, escrow, scheduled payouts, refunds, HCS log, Arkiv as the database, encrypted photos on Swarm, 0G check with safe-stop and recheck.
- [x] Security: operator and app keys, joined-only routes, booking cap. Tests: 19 passing.

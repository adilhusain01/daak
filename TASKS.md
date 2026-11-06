# Daak: tasks to submission

Submission closes Saturday 7 November, 09:00 IST. Judging 09:30 to 12:30. Requirements below are from the live prizes page and the rules page (ethglobal.com/events/mumbai/prizes and /info/details), read 6 November.

## Blockers: each one can cost a prize on its own

- [x] Repo public with an MIT licence.
- [ ] 0G credits from the 0G booth when it opens, then: the first real sealed check, the decision log on 0G Storage, "Recheck with 0G" on held handoffs, and the agent that pays for its own compute from a capped slice of each fee (Agents That Pay for Themselves). Wallet `0x575F8D53D5bE1d16d4c1eDb8D01C4B68A0D48901`.
- [ ] Demo video: 2:30 to 2:55 (ETHGlobal 2 to 4 minutes, 0G under 3), at least 720p, not recorded on a phone, a real voice (no AI voice, no music over captions in place of speaking), intro under 20 seconds, at most 4 bullets a slide, a settled payment on HashScan, the Swarm moment with its timestamp noted in `arkiv/swarm.md`.
- [ ] Team: each teammate commits their own real part (video, slides, field test, data) and can explain it to judges.
- [x] Planning artifacts and prompts committed (the rules require them for spec-driven work): `docs/planning/`.

## Sponsor paperwork

- [x] `LICENSE` (MIT) and a licence line in the README.
- [x] README: one Arkiv query judges can run, the writing wallet, Hedera transaction ids, architecture and payment flow.
- [x] `arkiv/schema.md` up to date (standing orders, KYC columns, weight, fee in paise).
- [x] `arkiv/swarm.md`: an example entity key with its sealed reference, the postage batch, upload and read code, reproduction steps. Demo timestamp and a fresh example after recording.
- [x] `web/README.md`: replace the create-next-app text.
- [ ] Submission form: paste from `docs/submission.md` (drafted: description, how it's made, per-partner use and feedback); select the Swarm bonus; fill the 0G lines once it runs.

## Hedera

- [x] x402 price equals the booking (meter plus booking fee for the chosen weight), settled in dINR (KNP-5021, tx 0.0.9185802-1793921489-636560474).
- [x] Endpoint discovery: the agent reads `/.well-known/x402` first, then books.
- [x] Each shop has its own agent account with prepaid dINR, topped up by UPI (operator enters the UTR on the dashboard; the app opens the UPI app); spend controls per shop.
- [x] `DAAK_UPI_ID` set in Vercel; `X402_ASSET` unset (dINR).
- [ ] Optional: dINR rebuilt on Stablecoin Studio (KYC, freeze, roles) for the Tokenize track.
- [x] Agent identity (HCS-14), phone number login, self-custody, timetables, ETAs and SMS: moved to the README roadmap as milestones.

## Product, from the people using it

- [x] Public read-only view of deliveries at `/live` (no photos, KYC, UPI or bank details), so partner judges see it without a passcode.
- [x] Drivers accept or decline a job from the app; the answer goes on the HCS log and shows on `/live` and the dashboard. Reassigning a declined stretch is still the operator (refund or rebook).
- [ ] Verify Ramesh's and Suresh's IDs before the demo (they show "ID not checked").

## The team

- [ ] Each teammate joins with their own badge and real UPI ID (the real ₹ UPI moment).
- [ ] One real conversation or 20-second clip with a bus parcel booking office or a sender.
- [ ] Real paid deliveries during the hackathon (see `docs/business.md`, "Traction before Saturday").
- [x] `HOLDBACK_HOURS=0.25` set in Vercel and redeployed.
- [ ] Reset `DATA_SINCE` to the start of the clean demo run (hides today's test bookings).
- [x] `CRON_SECRET` and `DATA_SINCE` set in Vercel.
- [ ] NFC stickers (Amazon, Friday 8 am to 12 pm). Each new sticker joins from the app as a person: a shop, a second driver, the receiving shop.
- [ ] Run and film a real three-hop delivery with the stickers.

## Story and submission

- [ ] Slides (4, at most four bullets each) and rehearsal with stickers and two phones. Script, video shot list and answers to judges' and VCs' questions are drafted in `docs/demo.md`.
- [ ] The cinematic film as a 15-second opener at most (it cannot be the submission video: no voice).
- [ ] Final README pass: 0G proof or the outage write-up, the business numbers.

## Done

- [x] Backup check for 0G outages: Cloudflare Workers AI or Gemini, labelled and unsealed, can only hold a payment (a pass still waits for 0G); 0G recheck covers backup-held hops; wrong badges or place hold regardless. Live on Cloudflare Workers AI (Llama 4 Scout): tested locally and on the live site (KNP-1204: wrong code held, right code passed and waits for 0G).

- [x] HCS-14 agent identity: Daak and every shop agent have a UAID (matches Hashgraph Online's SDK byte for byte); the agent verifies Daak before paying; each booking records the paying agent's UAID on HCS (messages 56 to 58).

- [x] Bus times and ETAs: drivers publish bus times, plans chain connecting buses, ETAs on every stop and screen, running-late flags, decline and day-off hand the stretch to the next connecting driver (tested on testnet: KNP-0324). Next: HCS-14 agent identity.

- [x] App tab bar: a segmented switch pinned at the bottom, tabs by role (driver: Jobs, Hand over, Earnings, Me; shop: Book, Parcels, Balance, Me; receiver: Receive, Track, Me), each tab keeps its place, Back returns to the first tab.

- [x] Split payout with a holdback: 50, 70 or 90% at the confirmed handover by record; holdbacks in one Hedera schedule that releases itself after `HOLDBACK_HOURS`; the liable leg repays the shop; protection pool from 1 point of the booking fee.
- [x] Bus number checked against the plate format, bus operator, and driver KYC (ID type, last 4, encrypted ID photo, operator verifies, decision on HCS).
- [x] Weight in the meter: four bands, every price shown before paying, carried into daily orders (KNP-8812).
- [x] Standing orders: daily repeat booking, booked and paid at 04:00 IST by Vercel Cron, the day's parcel attaches with a tap (KNP-3047).
- [x] Booking fee: 12% of the meter, at least ₹5. Meter on road km (87 and 272).
- [x] Network map (`/network`): India Post offices, OpenStreetMap bus stations, the corridor along the road.
- [x] App: join, roles, booking with receiver, drivers and weight, handoffs from either phone, signed on the phone, offline queue, Hindi first, My work, Bachat, fuel advance, daily orders; tidied.
- [x] Web: landing, operator dashboard, drivers, tracking, disputes, UPI QR with UTR on chain, full-width layout.
- [x] Chain: x402 booking on Hedera, dINR with a 2% custom fee, escrow, split payout, self-releasing holdbacks, refunds, HCS log, Arkiv as the database, encrypted photos on Swarm, 0G check with safe-stop and recheck.
- [x] Security: operator and app keys, joined-only routes, booking cap, signed handoffs. Tests: 23 passing.

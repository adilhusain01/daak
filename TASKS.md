# Daak: tasks to submission

Submission closes Saturday 7 November, 09:00 IST. Judging 09:30 to 12:30. Requirements below are from the live prizes page and the rules page (ethglobal.com/events/mumbai/prizes and /info/details), read 6 November.

## Blockers: each one can cost a prize on its own

- [ ] One clean rehearsal from the phone with a new photo per stop that runs each path once, so the public log shows them: green or backup-checked handoffs with signatures, an approval, a 0G recheck, a pay-anyway, a refund to the shop, a KYC check, a UPI UTR. Then set `DATA_SINCE`.

- [x] Repo public with an MIT licence.
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
- [x] Stablecoin Studio skipped: it issues through its own Solidity contracts, which would weaken No Solidity.
- [x] Agent identity (HCS-14), phone number login, self-custody, timetables, ETAs and SMS: moved to the README roadmap as milestones.

## Product, from the people using it

- [x] Public read-only view of deliveries at `/live` (no photos, KYC, UPI or bank details), so partner judges see it without a passcode.
- [x] Drivers accept or decline a job from the app; the answer goes on the HCS log and shows on `/live` and the dashboard. Reassigning a declined stretch is still the operator (refund or rebook).
- [ ] Verify Ramesh's, Suresh's and Adil's IDs before the demo: in /ops, "Ask 0G to read it" first, then Verify (0G's sealed provider was failing its price quote after 12:40 on 6 Nov; retry).

## The team

- [ ] Each teammate joins with their own badge and real UPI ID (the real ₹ UPI moment).
- [ ] One real conversation or 20-second clip with a bus parcel booking office or a sender.
- [ ] Real paid deliveries during the hackathon (see `docs/business.md`, "Traction before Saturday").
- [x] `HOLDBACK_HOURS=0.25` set in Vercel and redeployed.
- [ ] Reset `DATA_SINCE` to the start of the clean demo run (hides today's test bookings).
- [x] `CRON_SECRET` and `DATA_SINCE` set in Vercel.
- [ ] NFC stickers (Amazon, Friday 8 am to 12 pm). Each new sticker joins from the app as a person: a shop, a second driver, the receiving shop.
- [ ] Run and film a real three-hop delivery with the stickers, one handoff by code with two phones ("both phones signed").
- [ ] Adil's driver record: switch to Lucknow to Gorakhpur from the Me tab, so Ramesh hands over to him at Lucknow.
- [ ] Film one vouch: Ramesh (ID verified) scans Adil's code from the Me tab.

## From the audit, not done

- [ ] 0G's only sealed vision provider (`0xf4FB…B250`) went unhealthy at about 12:40 on 6 Nov; once it is back, run `scripts/zg-check.mts` for the first self-paid check receipt and put it in `docs/submission.md`.
- [ ] Read the holdback schedule's inner transaction result, not only "executed".
- [ ] A new phone for an existing Google account: accept its key only after a vouch or the operator (today it goes through the operator).

## Story and submission

- [ ] Slides (4, at most four bullets each) and rehearsal with stickers and two phones. Script, video shot list and answers to judges' and VCs' questions are drafted in `docs/demo.md`.
- [ ] The cinematic film as a 15-second opener at most (it cannot be the submission video: no voice). The full one-minute film now plays in the landing hero (`video/hero/film.tsx`, raea).
- [ ] Final README pass: 0G proof or the outage write-up, the business numbers.

## Done

- [x] Hardening (6 Nov): job answers and day-off signed by the driver's phone; operator passcode locks after 5 wrong tries in 15 minutes (per server instance); held reasons spoken and shown in Hindi; the HCS log cached by sequence; a refused handoff (expired code, wrong person) is shown, not queued as offline. Operator sessions are signed with the server secret, tied to the passcode and expire after 3 days.

- [x] 0G (6 Nov): 10 0G bridged in by Adil; decision records on 0G Storage mainnet; Daak's own compute account (3 0G) pays the sealed provider first with TEE signatures verified, Router credit as fallback; each booking moves 2% of its fee in dINR on Hedera and the same value in 0G into the compute account, both on the HCS log (first: 44 paise and 0.032 0G).

- [x] Identity without stickers (6 Nov): Continue with Google (server checks the token; Daak id is a hash of the Google account id; email sealed); two-signature handoffs by QR code (fresh 2 minutes from the handoff time, single use, both signatures on HCS), badge tap kept as the one-phone fallback; vouching with limits (3 in 30 days, none for 90 days after a vouched driver is found responsible); 0G reads ID photos in a sealed machine for the operator; drivers edit stretches and bus times from the Me tab, signed by their phone. Adil joined with Google.
- [x] 0G sealed check live through the Router (6 Nov); KNP-1204 rechecked green and its held pay released itself at 11:44.
- [x] Full end-to-end run KNP-3WAE9 (7 Nov, one phone, five NFC stickers): booked over x402 (Rs 599.26, 24 kg), accepted by both drivers, three handovers checked sealed by 0G, advances Rs 64.83 and Rs 202.69, holdbacks Rs 267.53 released themselves at 00:34:05. It is the showcase in the README, landing receipts and briefs.
- [x] Parcel lists paged on the server with filters and search on /ops, /live and in the app, each parcel with its own page; Ask Daak as a floating chat; one Daak mark (ड) everywhere; the app in one language at a time; the landing page told as KNP-1204's journey with each integration and its proof.
- [x] `STAND_RADIUS_M=0` set in Vercel.

- [x] 0G sealed check live (6 Nov): $1 Router credit, key in private (TEE-only) trust mode, `0gm-1.0-35b-a3b` on Intel TDX, pinned to a TEE-acknowledged provider; first checks matched KNP-7115 and refused KNP-9999 (ids in `docs/submission.md`); budget 20 s; key in Vercel.
- [x] Audit fixes (Fable audit, 6 Nov): signatures required when a party has a registered phone; the 500 m stand check is real (stands' coordinates on every leg, accuracy capped at 200 m); the same photo never records or pays twice; random checked booking codes; refunds go to the shop's agent account and a delivery settles once; re-joining a badge refused, ID added from the Me tab signed by the phone; driver earnings need the app key, the public drivers page shows record and tier, public tracking carries no GPS; latest attempt per stop counts; 0G outages remembered for 10 minutes; booking never fails after escrow is funded; cash-out references unique; claims name the responsible stop and declared value; honest landing copy (2% fee, "redeemed").

- [x] Parcel route map on every tracking page: road route, done and upcoming stretches, the parcel's position (estimated from the bus time between stops), with a test.

- [x] Hedera Agent Kit: "Ask Daak" assistant on the dashboard, read-only Agent Kit query tools plus Daak tools on Cloudflare Workers AI (Mistral Small 3.1); suggestions are buttons from real delivery state, confirmed by the operator; questions audited on HCS. Tested: right held delivery and escrow balance (matches the mirror node).

- [x] Backup check for 0G outages: Cloudflare Workers AI or Gemini, labelled and unsealed, can only hold a payment (a pass still waits for 0G); 0G recheck covers backup-held hops; wrong badges or place hold regardless. Live on Cloudflare Workers AI (Llama 4 Scout): tested locally and on the live site (KNP-1204: wrong code held, right code passed and waits for 0G).

- [x] HCS-14 agent identity: Daak and every shop agent have a UAID (matches Hashgraph Online's SDK byte for byte); the agent verifies Daak before paying; each booking records the paying agent's UAID on HCS (messages 56 to 58).

- [x] Bus times and ETAs: drivers publish bus times, plans chain connecting buses, ETAs on every stop and screen, running-late flags, decline and day-off hand the stretch to the next connecting driver (tested on testnet: KNP-0324). Next: HCS-14 agent identity.

- [x] App tab bar: a segmented switch pinned at the bottom, tabs by role (driver: Jobs, Hand over, Earnings, Me; shop: Book, Parcels, Balance, Me; receiver: Receive, Track, Me), each tab keeps its place, Back returns to the first tab.

- [x] Split payout with a holdback: 50, 70 or 90% at the confirmed handover by record; holdbacks in one Hedera schedule that releases itself after `HOLDBACK_HOURS`; the liable leg repays the shop; protection pool from 1 point of the booking fee.
- [x] Bus number checked against the plate format, bus operator, and driver KYC (ID type, last 4, encrypted ID photo, operator verifies, decision on HCS).
- [x] Weight in the meter: four bands, every price shown before paying, carried into daily orders (KNP-8812).
- [x] 6 Nov afternoon: the shop enters weight and size; priced on the larger of the weight and L x W x H / 5,000, every kg over 5 adds a tenth of the meter, so driver pay follows the parcel (57 tests). Design pass after Umbra on web and app, the raea hero film, sourced state bus parcel figures on the landing, the four pitch slides at /pitch and docs/pitch.pdf.
- [x] Standing orders: daily repeat booking, booked and paid at 04:00 IST by Vercel Cron, the day's parcel attaches with a tap (KNP-3047).
- [x] Booking fee: 12% of the meter, at least ₹5. Meter on road km (87 and 272).
- [x] Network map (`/network`): India Post offices, OpenStreetMap bus stations, the corridor along the road.
- [x] App: join, roles, booking with receiver, drivers and weight, handoffs from either phone, signed on the phone, offline queue, Hindi first, My work, Bachat, fuel advance, daily orders; tidied.
- [x] Web: landing, operator dashboard, drivers, tracking, disputes, UPI QR with UTR on chain, full-width layout.
- [x] Chain: x402 booking on Hedera, dINR with a 2% custom fee, escrow, split payout, self-releasing holdbacks, refunds, HCS log, Arkiv as the database, encrypted photos on Swarm, 0G check with safe-stop and recheck.
- [x] Security: operator and app keys, joined-only routes, booking cap, signed handoffs. Tests: 23 passing.

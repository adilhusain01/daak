# Daak

Proof of handoff and fair pay for parcels that travel across several buses and drivers. Built at ETHGlobal Mumbai 2026.

Named after dak, the relay post: Sher Shah Suri's riders handed the mail from one dak chowki to the next along the Grand Trunk Road through Bihar and UP. Today, manufacturers in UP and Bihar still send parcels to small-town shops on buses, often across two buses with a driver-to-driver handoff at a bus stand. Nobody signs at the handoff, every driver quotes a different rate, drivers are paid in cash with no record of their work, and when a parcel arrives torn, everyone blames the next person.

Daak makes every handoff provable: both people's phones sign it, the lid is photographed, and a sealed AI on 0G checks the parcel at every stop. It prices every delivery on a published meter, and splits the fee automatically among the drivers by kilometre. Drivers, shops and retailers never see a wallet or a token: amounts are rupees and payouts go to UPI.

## How it works

1. **Booking (x402 on Hedera).** Each shop has its own agent: a Hedera account holding the shop's prepaid rupees as dINR, topped up when the shop pays Daak by UPI (the operator enters the UTR, which goes on the public log). When the shop taps a new parcel, the agent reads Daak's catalogue at `/.well-known/x402`, calls `/api/book`, gets `402 Payment Required` quoting the exact booking (meter plus booking fee for that distance and weight), pays it in dINR through the official x402 facilitator, and retries. No person approves the payment. Its spending controls allow only dINR, at most Rs 2,000 a booking, and only to Daak. Both sides carry an HCS-14 Universal Agent ID (`web/lib/uaid.ts`, checked byte for byte against Hashgraph Online's reference SDK): the catalogue publishes Daak's UAID with the fields it is computed from, the agent recomputes it and checks the account it is about to pay before paying, and sends its own UAID, which the booking route recomputes from the shop and its agent account and records with the booking on the HCS log.
2. **The Daak meter.** The fee is Rs 5 + Rs 0.50 a km, so Kanpur to Gorakhpur (359 km by road: 87 to Lucknow, 272 on to Gorakhpur) is Rs 184.50 for a parcel up to 5 kg. Heavier parcels multiply the meter: x1.5 up to 15 kg, x2 up to 30 kg, x3 up to 50 kg; over 50 kg is not a bus parcel. Distances are the driving route on OpenStreetMap roads, the same line the network map draws. The rate is printed on every booking.
3. **Escrow and the split payout (Hedera, no Solidity).** The fee is locked in escrow as dINR, an HTS token for rupee credits with a 2% fractional custom fee that pays Daak at the network level. Each driver's share, split by kilometre, is paid in two parts. The advance (50% for a new driver, 70% after 10 clean deliveries, 90% after 50 with 98% clean, fixed at booking from the public record) goes out when the next person confirms the handover. The holdback waits for delivery: all holdbacks go into one long-term scheduled transaction (`waitForExpiry`) that Hedera executes by itself after `HOLDBACK_HOURS` (24 by default), with no server watching. A claim in that window deletes the schedule, and the liable leg's holdback repays the shop.
4. **The handoff (Android app).** At the bus stand, the driver taps the parcel's NFC sticker, confirms the other person, and photographs the lid. The other person confirms in one of two ways: they show their code, a QR their own phone signs and renews every 30 seconds (good for two minutes and once, `checkReceiveProof` in `web/lib/signing.ts`), so both phones sign the handoff and both signatures go on the public log; or, with only one phone, they tap their badge. The phone adds its GPS fix, and a handoff more than 500 m from the stand (`STAND_RADIUS_M`; the phone's claimed accuracy counts for at most 200 m) is held. No signal? The handoff is signed and queued on the phone, and the payment waits; a retry with the same photo returns the first answer and is never recorded or paid twice. The Mumbai demo runs away from the UP stands, so it sets `STAND_RADIUS_M=0` and says so.
5. **The check (0G).** The photo goes to a sealed (TeeML) vision model on 0G, `0GM-1.0-35B-A3B` on Intel TDX, which answers: right parcel, right stop, still sealed? Daak asks it from its own 0G compute account first (0G Direct), verifying the provider's TEE signature on each answer, and through 0G's Router (private, TEE-only mode, on the team's credit) if that fails. Every decision is written to 0G Storage. Each booking pays its share of these checks: 2% of its booking fee moves in dINR on Hedera to a compute budget account, and the same value in 0G, at the live price, goes into the compute account; both transactions are on the HCS log with the booking (`web/lib/compute.ts`). If 0G cannot answer, the handoff is recorded as "tapped, not checked by AI" and the payment is held for a person to review. Nothing is faked. A labelled backup model (Cloudflare Workers AI, or Gemini) can look at the photo in that case, but it can only make things safer: if it sees the wrong code or damage, the payment is held and the driver is told at the stand; if it sees nothing wrong, the payment still waits for 0G's sealed recheck. Wrong badges or the wrong place hold the payment whatever any model says. `BACKUP_PAYS=1` lets a backup pass release money, for local testing only.
6. **The record (Hedera HCS, Arkiv, Swarm, 0G Storage).** The lid photo is stored on Swarm encrypted, its reference sealed inside the Arkiv record; each AI decision is a record on 0G Storage, its root hash on the Arkiv handoff. Every booking, handoff, payout, cash-out and Bachat deposit is a message on a public HCS topic. Consignments, handoffs and driver preferences are typed Arkiv entities; handoffs expire after a day. The retailer's tracking page and the operator dashboard read Arkiv.
7. **Delivery and pay.** Each confirmed handover pays that driver's advance, which is redeemed and sent to their UPI ID at once. When the last hop passes, the holdback timer starts; once it releases, the driver's dINR goes to UPI the next time they open the app. Every advance, holdback, redemption and refund goes on the HCS log. A protection pool gets 1 point of the meter from Daak's booking fee on every booking, up to a cap of Rs 2,000, and tops a refund up to the parcel's declared value.
8. **What drivers gain.** Bachat, an opt-in pot that keeps a share (5%) of every payout, recorded on chain. A work record computed only from the public HCS log (proven deliveries, km, clean rate) that unlocks a fuel advance (25% of the last 30 days' proven earnings, up to Rs 5,000). In production the pot and the advances sit with licensed partners.

## Architecture and payment flow

```
Shop's phone ──tap parcel──> /api/pack ──> shop's agent (Hedera account, prepaid dINR)
                                              │ GET /.well-known/x402   (finds the booking endpoint)
                                              │ POST /api/book  ──> 402, price = meter + booking fee
                                              │ pays in dINR via the x402 facilitator (fee payer 0.0.9185802)
                                              ▼
/api/book: record on Arkiv ──> meter locked in escrow (dINR) ──> 1 point to the protection pool ──> HCS "booked"

Driver's phone ──tap parcel, scan the other person's code (or tap their badge), photo, GPS, P-256 signatures──> /api/handoff
   ├─ 0G sealed vision check: Daak's own 0G compute account first, then the 0G Router (20 s budget; backup can only hold; safe-stop "not checked by AI")
   ├─ decision record on 0G Storage
   ├─ HCS message (hashes only) ── Arkiv handoff entity ── lid photo encrypted on Swarm
   └─ green: escrow pays that driver's advance (2% to Daak via the token's custom fee) ──> redeemed ──> UPI

Last hop green ──> one scheduled transfer of every holdback (waitForExpiry, executes itself after HOLDBACK_HOURS)
Claim in the window ──> schedule deleted, liable stretch's share and the pool repay the shop
Each booking ──> 2% of its fee in dINR to the compute budget (Hedera) + the same value in 0G into Daak's 0G compute account (0G)
```

The operator's assistant reads the network through the Hedera Agent Kit (`@hashgraph/hedera-agent-kit` with its Vercel AI SDK adapter), query plugins only. Hedera services used, all from the JavaScript SDK with no Solidity: HTS (the dINR token with a 2% fractional custom fee, escrow and payouts), HCS (the public log of every booking, handoff, payout and decision), scheduled transactions (holdbacks that release themselves; deleted on a claim), accounts with aliases for every shop agent and driver, and the mirror node REST API (balances, history, the drivers' records).

## Who does what

- **Joining.** Continue with Google (or tap a new badge) opens Join Daak in the app: role (driver, shop sending, shop receiving), name and mobile; drivers add their UPI ID, the bus number (checked against the Indian number plate format), who runs the bus (UPSRTC, BSRTC or private), the stretches they drive and a government ID for KYC; shops pick their bus stand. Phone and UPI are sealed (AES-GCM) before they reach the public Arkiv record.
- **Driver KYC.** The driver picks a driving licence (recommended, since it also shows they may drive the bus), a voter ID or a masked Aadhaar (first 8 digits covered), types its last 4 characters and photographs it. The photo is stored encrypted on Swarm; the ID type, last 4 and the sealed photo reference are sealed again on Arkiv. The full ID number is never kept. The operator asks 0G to read the photo in a sealed machine (the Cloudflare model reads it, labelled as not sealed, when 0G cannot), compares the reading with what the driver claimed, and verifies or rejects it; the decision goes on the HCS log by badge hash, and the drivers page shows "ID checked". In production this check moves to a licensed KYC partner (DigiLocker or the driving licence registry).
- **Booking.** The shop picks the receiver; Daak plans the stretches and suggests the best-proven driver for each (changeable), shows the meter fee, and the shop's agent pays over x402.
- **Handoffs.** The first is the pickup at the shop's stand. Any handoff can be recorded from either person's phone: tap the parcel, scan the other person's code (or tap their badge, checked against the expected one), photograph the lid.
- **Signed on the phone.** Each handoff is signed with a P-256 key held in the phone's secure hardware. The public key is on the person's Arkiv record and the signature is on the Hedera log. If the giver or the taker has a registered phone, the server refuses any handoff not signed by one of those phones, so neither Daak nor someone holding the app key can invent a handoff in their name.
- **Joining once.** A badge that has joined cannot be re-joined from a phone, so nobody can redirect a driver's UPI; changes go through the operator. A driver who joined before the ID check adds their ID from the Me tab, signed by their registered phone.
- **Daily orders.** After booking, a shop can make the same booking repeat Monday to Saturday. Vercel Cron runs at 04:00 IST (`web/vercel.json`, authorised by `CRON_SECRET`); the shop's agent books and pays each order that is due over x402, so the drivers see the parcel on their to-do list before it is packed. When the shop taps that day's parcel, the app attaches it to the paid booking. The operator can pause an order or book today's from the dashboard.
- **Bus times and ETAs.** Each driver publishes when their bus leaves on each stretch they run (Monday to Saturday by default); travel time is estimated at 40 km/h. A booking only chains buses that connect, with 20 minutes to change at the stand, and if nothing runs today it takes the next day's bus. Every stop carries its departure and ETA, shown to the shop before paying, on the to-do lists, the tracking page and `/live`, with "running late" once a stop is 30 minutes overdue. A driver who declines, or marks "not driving today", has their stretch handed to the next driver whose bus connects, and the later stops are re-planned; if nobody can take it, the operator is flagged.
- **Job offers.** A booked driver sees the stretch, its km and its pay as a new job in the app and accepts or declines; the answer goes on the HCS log and shows on `/live` and the dashboard.
- **The parcel on a map.** Every tracking page draws the parcel's route along the road (OSRM on OpenStreetMap): stretches already handed over in green, the rest dashed, and the parcel itself, at its last stop or, once the next bus has left, estimated along the road from the bus's departure and ETA (labelled as an estimate, never shown as GPS).
- **Parcel lists.** `/ops`, `/live` and the app list parcels a page at a time from the server, with filters (active, delivered, needs the operator) and search; each parcel opens its own page with its stops, checks, pay and proofs.
- **Ask Daak (Hedera Agent Kit).** The operator dashboard has an assistant, a chat that opens from the bottom right: ask "which deliveries are late or held?" or "how much is in escrow?". It reads Daak's records and the Hedera network through the Hedera Agent Kit's read-only query tools (account and token balances, topic messages, transaction records) on Cloudflare Workers AI (Mistral Small 3.1), so it cannot move money. What it suggests comes back as buttons, worked out from the real state of each delivery it mentions, which the operator confirms and which call the same audited endpoints as the rest of the dashboard. Every question is logged on HCS by its hash with the tools used.
- **Disputes.** A held delivery is resolved by the operator: pay the drivers anyway, or refund the shop. A refund names the liable leg (the held handover, or the last stop when the shop reports damage after delivery): that driver's unpaid pay goes back to the shop, drivers who handed over cleanly get their holdbacks at once, legs never carried are returned, and the pool tops up the rest. Both go on the public log.
- **Pay.** Drivers' dINR is redeemed and paid by UPI. Until a licensed payout partner is connected, the operator pays from the dashboard's UPI QR and records the bank reference (UTR) on the Hedera log next to the redemption.

## Who holds the keys

- **People sign in with their Google account** (every Android phone has one) **or by tapping a badge**. No passwords or seed phrases. The server checks Google's token; a person's Daak id is a hash of the Google account id, and the email is sealed with their phone and UPI ID.
- **Vouching.** Someone whose ID Daak has checked scans a newcomer's code and their phone signs "I know this person"; both signatures go on the public log and the newcomer's record shows who vouched. It suits routes where people already know each other, and it is the trust a lender later looks at. People can collude, so a vouch costs the voucher something: three vouches in 30 days at most, and none for 90 days after someone they vouched for is found responsible for a damaged parcel (`vouchStanding` in `web/lib/rules.ts`).
- **ID checks.** A driver's ID photo is stored encrypted. In `/ops` the operator can ask 0G to read it inside a sealed machine (ID type, name, last 4, whether a licence allows a bus, Aadhaar masking, signs of editing) and compare it with what the driver claimed; only the 0G receipt and which checks passed go on the public log. The operator still decides.
- **What a phone can change.** A driver changes their stretches and bus times from the Me tab, signed by their phone. Their UPI ID, phone number and name are changed only by the operator, so nobody holding a phone can redirect a driver's pay.
- **Each phone holds its own signing key** in the Android Keystore (secure hardware). The first phone a person uses registers its public key on their Arkiv record; every handoff from it is signed, and the server rejects a handoff for that person signed by any other key. A stolen badge or a copied badge ID cannot record handoffs in their name, and with codes the other person's phone has to sign too. Moving to a new phone goes through the operator.
- **Daak holds the Hedera keys** of shop agents, drivers, escrow and the pool, derived from one server secret (`keyFor` in `web/lib/payout.ts`). This is custodial, like PhonePe or Paytm holding a wallet, and it is deliberate: drivers and shops never see a wallet, a seed phrase or a token. Every movement of money is still public on Hedera, so the custody is auditable. A refund goes back to the shop's own agent account (its prepaid balance), and a delivery is settled only once.
- **In production** collections and escrow sit with a licensed payment aggregator, Bachat with a partner bank and advances with an NBFC; Daak stays the software and the public record.
- **The operator** (dashboard, ID checks, top-ups, disputes) signs in with a passcode; every decision they make goes on the HCS log with who made it.

## Security

- The operator dashboard (`/ops`) and every endpoint that moves money or reveals a photo or a person's details need the operator passcode (an httpOnly cookie). The phone app's endpoints need the app key built into the APK. The tracking page, the drivers page and the live counts are public.
- Only people who have joined can be on a route, and bookings are capped per hour (`BOOKINGS_PER_HOUR`), so a leaked app key cannot make the agent spend without limit.
- Server-held Hedera keys are derived from one master secret; the handoff signatures come from the phones, not the server.

## Tests

`cd web && npm test` runs the rules that decide money, trust and privacy, written before the code: the meter, the kilometre split, the advance tiers and holdbacks, the protection pool, Bachat, the fuel advance, route finding, the stand check, sealing, badge hashes, handoff signatures, the other person's code (fresh, single use, their phone), vouching and its limits, Google identities, comparing a 0G ID reading with the claim, and each booking's compute share and top-ups (47 tests).

## Live on testnet

| What | Id |
|---|---|
| HCS handoff log | [0.0.11327109](https://hashscan.io/testnet/topic/0.0.11327109) |
| dINR token (2% custom fee) | [0.0.11327356](https://hashscan.io/testnet/token/0.0.11327356) |
| Escrow account | [0.0.11327245](https://hashscan.io/testnet/account/0.0.11327245) |
| Daak operator and treasury | [0.0.11325722](https://hashscan.io/testnet/account/0.0.11325722) |
| A shop's agent (Gupta Garments) | [0.0.11331484](https://hashscan.io/testnet/account/0.0.11331484) |
| The shop's UPI top-up credited (Rs 500, UTR on the log) | [0.0.11325722-1793921478-044156522](https://hashscan.io/testnet/transaction/0.0.11325722-1793921478-044156522) |
| x402 settlement in dINR: the shop's agent pays exactly Rs 206.64 (Rs 184.50 meter + Rs 22.14 booking fee) to Daak, network fee paid by the facilitator 0.0.9185802 | [0.0.9185802-1793921489-636560474](https://hashscan.io/testnet/transaction/0.0.9185802-1793921489-636560474) |
| Earlier x402 settlement in HBAR (flat price mode) | [0.0.9185802-1793901050-675202430](https://hashscan.io/testnet/transaction/0.0.9185802-1793901050-675202430) |
| Executed scheduled payout (older, all at delivery) | [schedule 0.0.11327387](https://hashscan.io/testnet/schedule/0.0.11327387) |
| Holdback schedule that released itself at expiry | [schedule 0.0.11330730](https://hashscan.io/testnet/schedule/0.0.11330730) |
| Protection pool | [0.0.11330722](https://hashscan.io/testnet/account/0.0.11330722) |
| Daak's HCS-14 agent identity (UAID and its fields) | [HCS message 56](https://hashscan.io/testnet/topic/0.0.11327109?sequence=56) |
| A booking recording the paying shop agent's verified UAID (KNP-2703) | [HCS message 58](https://hashscan.io/testnet/topic/0.0.11327109?sequence=58) |
| 0G sealed checks that turned KNP-1204's three held stops green (11:28) | `chatcmpl-6eb1ede1…`, `chatcmpl-73f8e8bb…`, `chatcmpl-224ee09e…` |
| KNP-1204's held pay (Rs 92.26) released itself at 11:44:00, no server | [schedule 0.0.11335076](https://hashscan.io/testnet/schedule/0.0.11335076) |
| First AI decision record on 0G Storage (mainnet) | [tx 0xa90f5e64…](https://chainscan.0g.ai/tx/0xa90f5e64ebb33f64510f718c7c298373d6623235e48a52ea1519ed2f35ffb704), root `0xe803a6bf…77e9` |
| Daak's own 0G compute account opened (3 0G) | [tx 0xa1135dbf…](https://chainscan.0g.ai/tx/0xa1135dbf50dae2140d0c1e21aabc7e36fec2e372abc9280bb957dd9987f009d7), wallet `0x575F8D53D5bE1d16d4c1eDb8D01C4B68A0D48901` |
| A booking's compute share on Hedera (44 paise of dINR) | [0.0.11325722-1793951959-279453219](https://hashscan.io/testnet/transaction/0.0.11325722-1793951959-279453219) |
| The same share in 0G into the compute account (0.032 0G) | [tx 0x155619fe…](https://chainscan.0g.ai/tx/0x155619fe0b72df48ac06d0a647a3db260099f451892e937e2ebefbfabe91f6a2) |
| Arkiv owner wallet (Rabdi) | `0x610FdB41DA83138615C317c89fd9EB09271a46fe` |

Deployed web app: https://daak-ethglobal.vercel.app (landing at `/`, every delivery read-only at `/live`, operator dashboard at `/ops`, drivers at `/drivers`, the network map at `/network`, tracking at `/track/<code>`).

The network map draws India Post's 1,43,609 offices (All India Pincode Directory, GODL-India), 6,021 bus stations from OpenStreetMap (ODbL) and Daak's corridor along the road (OSRM), on an OpenFreeMap basemap. The data is baked into `web/public/map/india.json`, so the page calls no outside API except the map tiles.

## Layout

- `android/`: the Android app for shops, drivers and receivers. Kotlin, Jetpack Compose, Google sign-in (Credential Manager), NFC in reader mode, codes shown and scanned (ZXing, Google's code scanner), the system camera, GPS, Hindi or English with Hindi text-to-speech, an offline outbox.
- `web/`: Next.js. The API (`/api/book`, `/api/pack`, `/api/handoff`, `/api/review`, `/api/recheck`, `/api/google`, `/api/vouch`, `/api/kyc`, `/api/track/[code]`, `/api/live`, `/api/parcels/[uid]`, `/api/driver/[uid]`, `/api/consignments`), the landing page, `/live`, the operator dashboard and the tracking page. All sponsor keys stay here. `web/scripts/zg-direct-setup.mts`, `zg-compute.mts` and `zg-check.mts` open, show and test Daak's 0G compute account.
- `arkiv/`: how Daak uses Arkiv and Swarm, its schema and the friction we hit. `web/scripts/arkiv-query.mts` is a query anyone can run without keys.
- `docs/`: the business notes and `planning/` (decisions and the team's prompts).
- `video/`: the explainer film (HyperFrames).

## Getting started

Requirements: Node 22.10 or newer, JDK 17+ and the Android SDK, an Android phone with NFC.

```bash
# backend
cd web
cp .env.example .env.local      # fill in the values (never commit them)
npm install
npx tsx --env-file=.env.local scripts/setup-hedera.mts   # creates the HCS topic, once
npx tsx --env-file=.env.local scripts/setup-money.mts    # creates escrow and the dINR token, once
npm run dev                                              # http://localhost:3000

# a booking paid by the agent over x402, then two handoffs and an approval
npx tsx --env-file=.env.local scripts/agent-book.mts my-parcel test-badge-b
curl -X POST localhost:3000/api/handoff -F parcel=my-parcel -F from=<driver A badge> -F to=<driver B badge> -F photo=@lid.jpg

# Android app (debug build talks to the deployed backend; change API_BASE in android/app/build.gradle.kts)
cd ../android
./gradlew :app:installDebug
```

`.env.local` needs: `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (ECDSA), `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ZG_PRIVATE_KEY` (Daak's 0G wallet, with mainnet 0G for storage and its compute account), `ZG_ROUTER_KEY` (0G Router key, private mode, the fallback), `GOOGLE_CLIENT_ID` (the Web client id; the Android client needs the package and the signing SHA-1), `DAAK_MASTER_SECRET`, `DAAK_APP_KEY`, `OPERATOR_PASSCODE`, and optionally `X402_ASSET`/`X402_AMOUNT` (USDC settlement), `BOOKINGS_PER_HOUR`, `DATA_SINCE`, `BOOKING_FEE_PERCENT`, `BOOKING_FEE_MIN_RUPEES`, `HOLDBACK_HOURS`, `POOL_POINTS`, `POOL_CAP_RUPEES`, `CRON_SECRET`, `GEMINI_API_KEY` or `CF_ACCOUNT_ID` and `CF_AI_TOKEN` (the backup check), `BACKUP_PAYS`, `DAAK_UPI_ID` (where shops pay their top-ups) and the RazorpayX keys. `X402_ASSET` defaults to dINR (each shop's agent pays the exact booking); set it to `0.0.0` (HBAR) or `0.0.429274` (USDC) for a flat price paid by one shared agent. The Android build reads the app key from `android/local.properties` as `daakAppKey=`.

## Roadmap

- **DigiLocker for ID checks**: the driver consents in DigiLocker and Daak receives their driving licence or Aadhaar as a government-signed document instead of a photo, through a registered partner or a KYC provider; for a bus driver the licence also proves the vehicle class.
- **New phone by vouch**: a driver signing in with Google on a new phone gets its key accepted when a vouching driver or the operator approves, so a stolen Gmail password alone cannot take over someone's pay.
- **One human, one driver record** with World ID, for drivers who have it, so nobody escapes a bad record by joining again under a new account. The ID check (driving licence, voter ID, masked Aadhaar) does this today, since few drivers on rural routes can reach an Orb.
- **Phone number OTP at joining**, so a mobile number is verified, not just collected (needs an SMS sender registered on India's DLT).
- **Compute bought with fees**: today each booking's 2% compute share moves in dINR on Hedera and the agent deposits the same value from its 0G wallet; in production a payment partner buys that 0G with the rupees.
- **Opt-in self-custody**: a driver can move Bachat savings to a wallet only they control (Privy), without changing the tap-to-work flow.
- **Timetables, next steps**: built today are bus times per driver and stretch, connecting plans, ETAs, late flags, day-off and decline handovers. Next: an SMS to the receiving shop when the parcel is one stop away and when it arrives (needs a DLT-registered sender), re-planning a missed connection onto the next bus automatically, public holidays, and real average speeds per corridor from the handoff log instead of 40 km/h.
- **Stablecoin Studio**: issue dINR through Hedera's Stablecoin Studio for KYC, freeze and role controls and proof of reserve.

## Licence

MIT, see `LICENSE`.

## AI usage

See `AI_USAGE.md` for how AI tools were used, file by file.

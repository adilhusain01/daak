# Daak

Proof of handoff and fair pay for parcels that travel across several buses and drivers. Built at ETHGlobal Mumbai 2026.

Named after dak, the relay post: Sher Shah Suri's riders handed the mail from one dak chowki to the next along the Grand Trunk Road through Bihar and UP. Today, manufacturers in UP and Bihar still send parcels to small-town shops on buses, often across two buses with a driver-to-driver handoff at a bus stand. Nobody signs at the handoff, every driver quotes a different rate, drivers are paid in cash with no record of their work, and when a parcel arrives torn, everyone blames the next person.

Daak makes every handoff provable with a tap and a photo, has a sealed AI check the parcel at every stop, prices every delivery on a published meter, and splits the fee automatically among the drivers by kilometre. Drivers, shops and retailers never see a wallet or a token: amounts are rupees and payouts go to UPI.

## How it works

1. **Booking (x402 on Hedera).** Each shop has its own agent: a Hedera account holding the shop's prepaid rupees as dINR, topped up when the shop pays Daak by UPI (the operator enters the UTR, which goes on the public log). When the shop taps a new parcel, the agent reads Daak's catalogue at `/.well-known/x402`, calls `/api/book`, gets `402 Payment Required` quoting the exact booking (meter plus booking fee for that distance and weight), pays it in dINR through the official x402 facilitator, and retries. No person approves the payment. Its spending controls allow only dINR, at most Rs 2,000 a booking, and only to Daak. Both sides carry an HCS-14 Universal Agent ID (`web/lib/uaid.ts`, checked byte for byte against Hashgraph Online's reference SDK): the catalogue publishes Daak's UAID with the fields it is computed from, the agent recomputes it and checks the account it is about to pay before paying, and sends its own UAID, which the booking route recomputes from the shop and its agent account and records with the booking on the HCS log.
2. **The Daak meter.** The fee is Rs 5 + Rs 0.50 a km, so Kanpur to Gorakhpur (359 km by road: 87 to Lucknow, 272 on to Gorakhpur) is Rs 184.50 for a parcel up to 5 kg. Heavier parcels multiply the meter: x1.5 up to 15 kg, x2 up to 30 kg, x3 up to 50 kg; over 50 kg is not a bus parcel. Distances are the driving route on OpenStreetMap roads, the same line the network map draws. The rate is printed on every booking.
3. **Escrow and the split payout (Hedera, no Solidity).** The fee is locked in escrow as dINR, an HTS token for rupee credits with a 2% fractional custom fee that pays Daak at the network level. Each driver's share, split by kilometre, is paid in two parts. The advance (50% for a new driver, 70% after 10 clean deliveries, 90% after 50 with 98% clean, fixed at booking from the public record) goes out when the next person confirms the handover. The holdback waits for delivery: all holdbacks go into one long-term scheduled transaction (`waitForExpiry`) that Hedera executes by itself after `HOLDBACK_HOURS` (24 by default), with no server watching. A claim in that window deletes the schedule, and the liable leg's holdback repays the shop.
4. **The handoff (Android app).** At the bus stand, the driver taps the parcel's NFC sticker, taps the next driver's badge and photographs the lid. The phone adds its GPS fix. No signal? The handoff is signed and queued on the phone, and the payment waits.
5. **The check (0G).** The photo goes to a sealed (TeeML) vision model on 0G, `qwen3.7-plus`, which answers: right parcel, right stop, still sealed? If 0G cannot answer, the handoff is recorded as "tapped, not checked by AI" and the payment is held for a person to review. Nothing is faked.
6. **The record (Hedera HCS, Arkiv, Swarm).** The lid photo is stored on Swarm encrypted, its reference sealed inside the Arkiv record. Every booking, handoff, payout, cash-out and Bachat deposit is a message on a public HCS topic. Consignments, handoffs and driver preferences are typed Arkiv entities; handoffs expire after a day. The retailer's tracking page and the operator dashboard read Arkiv.
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

Driver's phone ──tap parcel, tap badge, photo, GPS, P-256 signature──> /api/handoff
   ├─ 0G sealed vision check (12 s budget; safe-stop "not checked by AI" if 0G cannot answer)
   ├─ HCS message (hashes only) ── Arkiv handoff entity ── lid photo encrypted on Swarm
   └─ green: escrow pays that driver's advance (2% to Daak via the token's custom fee) ──> redeemed ──> UPI

Last hop green ──> one scheduled transfer of every holdback (waitForExpiry, executes itself after HOLDBACK_HOURS)
Claim in the window ──> schedule deleted, liable stretch's share and the pool repay the shop
```

Hedera services used, all from the JavaScript SDK with no Solidity: HTS (the dINR token with a 2% fractional custom fee, escrow and payouts), HCS (the public log of every booking, handoff, payout and decision), scheduled transactions (holdbacks that release themselves; deleted on a claim), accounts with aliases for every shop agent and driver, and the mirror node REST API (balances, history, the drivers' records).

## Who does what

- **Joining.** A new badge opens Join Daak in the app: role (driver, shop sending, shop receiving), name and mobile; drivers add their UPI ID, the bus number (checked against the Indian number plate format), who runs the bus (UPSRTC, BSRTC or private), the stretches they drive and a government ID for KYC; shops pick their bus stand. Phone and UPI are sealed (AES-GCM) before they reach the public Arkiv record.
- **Driver KYC.** The driver picks a driving licence (recommended, since it also shows they may drive the bus), a voter ID or a masked Aadhaar (first 8 digits covered), types its last 4 characters and photographs it. The photo is stored encrypted on Swarm; the ID type, last 4 and the sealed photo reference are sealed again on Arkiv. The full ID number is never kept. The operator opens the photo on the dashboard and verifies or rejects it; the decision goes on the HCS log by badge hash, and the drivers page shows "ID checked". In production this check moves to a licensed KYC partner (DigiLocker or the driving licence registry).
- **Booking.** The shop picks the receiver; Daak plans the stretches and suggests the best-proven driver for each (changeable), shows the meter fee, and the shop's agent pays over x402.
- **Handoffs.** The first is the pickup at the shop's stand. Any handoff can be recorded from either person's phone: tap the parcel, tap the other person's badge (checked against the expected badge), photograph the lid.
- **Signed on the phone.** Each handoff is signed with a P-256 key held in the phone's secure hardware. The public key is on the person's Arkiv record and the signature is on the Hedera log, so Daak cannot invent a handoff in someone's name.
- **Daily orders.** After booking, a shop can make the same booking repeat Monday to Saturday. Vercel Cron runs at 04:00 IST (`web/vercel.json`, authorised by `CRON_SECRET`); the shop's agent books and pays each order that is due over x402, so the drivers see the parcel on their to-do list before it is packed. When the shop taps that day's parcel, the app attaches it to the paid booking. The operator can pause an order or book today's from the dashboard.
- **Bus times and ETAs.** Each driver publishes when their bus leaves on each stretch they run (Monday to Saturday by default); travel time is estimated at 40 km/h. A booking only chains buses that connect, with 20 minutes to change at the stand, and if nothing runs today it takes the next day's bus. Every stop carries its departure and ETA, shown to the shop before paying, on the to-do lists, the tracking page and `/live`, with "running late" once a stop is 30 minutes overdue. A driver who declines, or marks "not driving today", has their stretch handed to the next driver whose bus connects, and the later stops are re-planned; if nobody can take it, the operator is flagged.
- **Job offers.** A booked driver sees the stretch, its km and its pay as a new job in the app and accepts or declines; the answer goes on the HCS log and shows on `/live` and the dashboard.
- **Disputes.** A held delivery is resolved by the operator: pay the drivers anyway, or refund the shop. A refund names the liable leg (the held handover, or the last stop when the shop reports damage after delivery): that driver's unpaid pay goes back to the shop, drivers who handed over cleanly get their holdbacks at once, legs never carried are returned, and the pool tops up the rest. Both go on the public log.
- **Pay.** Drivers' dINR is redeemed and paid by UPI. Until a licensed payout partner is connected, the operator pays from the dashboard's UPI QR and records the bank reference (UTR) on the Hedera log next to the redemption.

## Who holds the keys

- **People sign in by tapping their badge**, an NFC card. No passwords or seed phrases: a driver at a bus stand taps and is in.
- **Each phone holds its own signing key** in the Android Keystore (secure hardware). The first phone a person uses registers its public key on their Arkiv record; every handoff from it is signed, and the server rejects a handoff for that person signed by any other key. A stolen badge on another phone cannot record handoffs in their name. Moving to a new phone goes through the operator.
- **Daak holds the Hedera keys** of shop agents, drivers, escrow and the pool, derived from one server secret (`keyFor` in `web/lib/payout.ts`). This is custodial, like PhonePe or Paytm holding a wallet, and it is deliberate: drivers and shops never see a wallet, a seed phrase or a token. Every movement of money is still public on Hedera, so the custody is auditable.
- **In production** collections and escrow sit with a licensed payment aggregator, Bachat with a partner bank and advances with an NBFC; Daak stays the software and the public record.
- **The operator** (dashboard, ID checks, top-ups, disputes) signs in with a passcode; every decision they make goes on the HCS log with who made it.

## Security

- The operator dashboard (`/ops`) and every endpoint that moves money or reveals a photo or a person's details need the operator passcode (an httpOnly cookie). The phone app's endpoints need the app key built into the APK. The tracking page, the drivers page and the live counts are public.
- Only people who have joined can be on a route, and bookings are capped per hour (`BOOKINGS_PER_HOUR`), so a leaked app key cannot make the agent spend without limit.
- Server-held Hedera keys are derived from one master secret; the handoff signatures come from the phones, not the server.

## Tests

`cd web && npm test` runs the rules that decide money and privacy: the meter, the kilometre split, the advance tiers and holdbacks, the protection pool, Bachat, the fuel advance, route finding, sealing, badge hashes and handoff signatures.

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
| Arkiv owner wallet (Rabdi) | `0x610FdB41DA83138615C317c89fd9EB09271a46fe` |

Deployed web app: https://daak-ethglobal.vercel.app (landing at `/`, every delivery read-only at `/live`, operator dashboard at `/ops`, drivers at `/drivers`, the network map at `/network`, tracking at `/track/<code>`).

The network map draws India Post's 1,43,609 offices (All India Pincode Directory, GODL-India), 6,021 bus stations from OpenStreetMap (ODbL) and Daak's corridor along the road (OSRM), on an OpenFreeMap basemap. The data is baked into `web/public/map/india.json`, so the page calls no outside API except the map tiles.

## Layout

- `android/`: the Android app for shops, drivers and receivers. Kotlin, Jetpack Compose, NFC in reader mode, the system camera, GPS, Hindi text-to-speech, an offline outbox.
- `web/`: Next.js. The API (`/api/book`, `/api/pack`, `/api/handoff`, `/api/review`, `/api/track/[code]`, `/api/driver/[uid]`, `/api/consignments`), the operator dashboard and the tracking page. All sponsor keys stay here.
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

`.env.local` needs: `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (ECDSA), `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ZG_PRIVATE_KEY` (with mainnet 0G for the vision check), `DAAK_MASTER_SECRET`, `DAAK_APP_KEY`, `OPERATOR_PASSCODE`, and optionally `X402_ASSET`/`X402_AMOUNT` (USDC settlement), `BOOKINGS_PER_HOUR`, `DATA_SINCE`, `BOOKING_FEE_PERCENT`, `BOOKING_FEE_MIN_RUPEES`, `HOLDBACK_HOURS`, `POOL_POINTS`, `POOL_CAP_RUPEES`, `CRON_SECRET`, `DAAK_UPI_ID` (where shops pay their top-ups) and the RazorpayX keys. `X402_ASSET` defaults to dINR (each shop's agent pays the exact booking); set it to `0.0.0` (HBAR) or `0.0.429274` (USDC) for a flat price paid by one shared agent. The Android build reads the app key from `android/local.properties` as `daakAppKey=`.

## Roadmap

- **Phone number login and OTP at joining**, so a mobile number is verified, not just collected (needs an SMS sender registered on India's DLT).
- **Opt-in self-custody**: a driver can move Bachat savings to a wallet only they control (Privy), without changing the tap-to-work flow.
- **Timetables, next steps**: built today are bus times per driver and stretch, connecting plans, ETAs, late flags, day-off and decline handovers. Next: an SMS to the receiving shop when the parcel is one stop away and when it arrives (needs a DLT-registered sender), re-planning a missed connection onto the next bus automatically, public holidays, and real average speeds per corridor from the handoff log instead of 40 km/h.
- **Stablecoin Studio**: issue dINR through Hedera's Stablecoin Studio for KYC, freeze and role controls and proof of reserve.

## Licence

MIT, see `LICENSE`.

## AI usage

See `AI_USAGE.md` for how AI tools were used, file by file.

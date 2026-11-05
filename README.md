# Daak

Proof of handoff and fair pay for parcels that travel across several buses and drivers. Built at ETHGlobal Mumbai 2026.

Named after dak, the relay post: Sher Shah Suri's riders handed the mail from one dak chowki to the next along the Grand Trunk Road through Bihar and UP. Today, manufacturers in UP and Bihar still send parcels to small-town shops on buses, often across two buses with a driver-to-driver handoff at a bus stand. Nobody signs at the handoff, every driver quotes a different rate, drivers are paid in cash with no record of their work, and when a parcel arrives torn, everyone blames the next person.

Daak makes every handoff provable with a tap and a photo, has a sealed AI check the parcel at every stop, prices every delivery on a published meter, and splits the fee automatically among the drivers by kilometre. Drivers, shops and retailers never see a wallet or a token: amounts are rupees and payouts go to UPI.

## How it works

1. **Booking (x402 on Hedera).** The shop taps a new parcel. The shop's ordering agent books the delivery on `/api/book`, gets `402 Payment Required`, pays from its own Hedera account through the official x402 facilitator, and retries. Its spending controls allow HBAR only, at most 2 HBAR a booking, and only to Daak.
2. **The Daak meter.** The fee is Rs 5 + Rs 0.50 a km, so Kanpur to Gorakhpur (359 km by road: 87 to Lucknow, 272 on to Gorakhpur) is Rs 184.50. Distances are the driving route on OpenStreetMap roads, the same line the network map draws. The rate is printed on every booking.
3. **Escrow and the split payout (Hedera, no Solidity).** The fee is locked in escrow as dINR, an HTS token for rupee credits with a 2% fractional custom fee that pays Daak at the network level. Each driver's share, split by kilometre, is paid in two parts. The advance (50% for a new driver, 70% after 10 clean deliveries, 90% after 50 with 98% clean, fixed at booking from the public record) goes out when the next person confirms the handover. The holdback waits for delivery: all holdbacks go into one long-term scheduled transaction (`waitForExpiry`) that Hedera executes by itself after `HOLDBACK_HOURS` (24 by default), with no server watching. A claim in that window deletes the schedule, and the liable leg's holdback repays the shop.
4. **The handoff (Android app).** At the bus stand, the driver taps the parcel's NFC sticker, taps the next driver's badge and photographs the lid. The phone adds its GPS fix. No signal? The handoff is signed and queued on the phone, and the payment waits.
5. **The check (0G).** The photo goes to a sealed (TeeML) vision model on 0G, `qwen3.7-plus`, which answers: right parcel, right stop, still sealed? If 0G cannot answer, the handoff is recorded as "tapped, not checked by AI" and the payment is held for a person to review. Nothing is faked.
6. **The record (Hedera HCS, Arkiv, Swarm).** The lid photo is stored on Swarm encrypted, its reference sealed inside the Arkiv record. Every booking, handoff, payout, cash-out and Bachat deposit is a message on a public HCS topic. Consignments, handoffs and driver preferences are typed Arkiv entities; handoffs expire after a day. The retailer's tracking page and the operator dashboard read Arkiv.
7. **Delivery and pay.** Each confirmed handover pays that driver's advance, which is redeemed and sent to their UPI ID at once. When the last hop passes, the holdback timer starts; once it releases, the driver's dINR goes to UPI the next time they open the app. Every advance, holdback, redemption and refund goes on the HCS log. A protection pool gets 1 point of the meter from Daak's booking fee on every booking, up to a cap of Rs 2,000, and tops a refund up to the parcel's declared value.
8. **What drivers gain.** Bachat, an opt-in pot that keeps a share (5%) of every payout, recorded on chain. A work record computed only from the public HCS log (proven deliveries, km, clean rate) that unlocks a fuel advance (25% of the last 30 days' proven earnings, up to Rs 5,000). In production the pot and the advances sit with licensed partners.

## Who does what

- **Joining.** A new badge opens Join Daak in the app: role (driver, shop sending, shop receiving), name and mobile; drivers add their UPI ID, the bus number (checked against the Indian number plate format), who runs the bus (UPSRTC, BSRTC or private), the stretches they drive and a government ID for KYC; shops pick their bus stand. Phone and UPI are sealed (AES-GCM) before they reach the public Arkiv record.
- **Driver KYC.** The driver picks a driving licence (recommended, since it also shows they may drive the bus), a voter ID or a masked Aadhaar (first 8 digits covered), types its last 4 characters and photographs it. The photo is stored encrypted on Swarm; the ID type, last 4 and the sealed photo reference are sealed again on Arkiv. The full ID number is never kept. The operator opens the photo on the dashboard and verifies or rejects it; the decision goes on the HCS log by badge hash, and the drivers page shows "ID checked". In production this check moves to a licensed KYC partner (DigiLocker or the driving licence registry).
- **Booking.** The shop picks the receiver; Daak plans the stretches and suggests the best-proven driver for each (changeable), shows the meter fee, and the shop's agent pays over x402.
- **Handoffs.** The first is the pickup at the shop's stand. Any handoff can be recorded from either person's phone: tap the parcel, tap the other person's badge (checked against the expected badge), photograph the lid.
- **Signed on the phone.** Each handoff is signed with a P-256 key held in the phone's secure hardware. The public key is on the person's Arkiv record and the signature is on the Hedera log, so Daak cannot invent a handoff in someone's name.
- **Disputes.** A held delivery is resolved by the operator: pay the drivers anyway, or refund the shop. A refund names the liable leg (the held handover, or the last stop when the shop reports damage after delivery): that driver's unpaid pay goes back to the shop, drivers who handed over cleanly get their holdbacks at once, legs never carried are returned, and the pool tops up the rest. Both go on the public log.
- **Pay.** Drivers' dINR is redeemed and paid by UPI. Until a licensed payout partner is connected, the operator pays from the dashboard's UPI QR and records the bank reference (UTR) on the Hedera log next to the redemption.

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
| Shop's sender agent | [0.0.11327358](https://hashscan.io/testnet/account/0.0.11327358) |
| x402 settlement (agent to Daak, 1 HBAR, fee paid by the facilitator 0.0.9185802) | [0.0.9185802-1793901050-675202430](https://hashscan.io/testnet/transaction/0.0.9185802-1793901050-675202430) |
| Executed scheduled payout (older, all at delivery) | [schedule 0.0.11327387](https://hashscan.io/testnet/schedule/0.0.11327387) |
| Holdback schedule that released itself at expiry | [schedule 0.0.11330730](https://hashscan.io/testnet/schedule/0.0.11330730) |
| Protection pool | [0.0.11330722](https://hashscan.io/testnet/account/0.0.11330722) |
| Arkiv owner wallet (Rabdi) | `0x610FdB41DA83138615C317c89fd9EB09271a46fe` |

Deployed web app: https://daak-ethglobal.vercel.app (landing at `/`, operator dashboard at `/ops`, drivers at `/drivers`, the network map at `/network`, tracking at `/track/<code>`).

The network map draws India Post's 1,43,609 offices (All India Pincode Directory, GODL-India), 6,021 bus stations from OpenStreetMap (ODbL) and Daak's corridor along the road (OSRM), on an OpenFreeMap basemap. The data is baked into `web/public/map/india.json`, so the page calls no outside API except the map tiles.

## Layout

- `android/`: the Android app for shops, drivers and receivers. Kotlin, Jetpack Compose, NFC in reader mode, the system camera, GPS, Hindi text-to-speech, an offline outbox.
- `web/`: Next.js. The API (`/api/book`, `/api/pack`, `/api/handoff`, `/api/review`, `/api/track/[code]`, `/api/driver/[uid]`, `/api/consignments`), the operator dashboard and the tracking page. All sponsor keys stay here.
- `arkiv/`: how Daak uses Arkiv and Swarm, its schema and the friction we hit.
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

`.env.local` needs: `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (ECDSA), `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ZG_PRIVATE_KEY` (with mainnet 0G for the vision check), `DAAK_MASTER_SECRET`, `DAAK_APP_KEY`, `OPERATOR_PASSCODE`, and optionally `X402_ASSET`/`X402_AMOUNT` (USDC settlement), `BOOKINGS_PER_HOUR`, `DATA_SINCE`, `BOOKING_FEE_PERCENT`, `BOOKING_FEE_MIN_RUPEES`, `HOLDBACK_HOURS`, `POOL_POINTS`, `POOL_CAP_RUPEES` and the RazorpayX keys. The Android build reads the app key from `android/local.properties` as `daakAppKey=`.

## AI usage

See `AI_USAGE.md` for how AI tools were used, file by file.

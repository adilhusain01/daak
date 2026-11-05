# Daak

Proof of handoff and fair pay for parcels that travel across several buses and drivers. Built at ETHGlobal Mumbai 2026.

Named after dak, the relay post: Sher Shah Suri's riders handed the mail from one dak chowki to the next along the Grand Trunk Road through Bihar and UP. Today, manufacturers in UP and Bihar still send parcels to small-town shops on buses, often across two buses with a driver-to-driver handoff at a bus stand. Nobody signs at the handoff, every driver quotes a different rate, drivers are paid in cash with no record of their work, and when a parcel arrives torn, everyone blames the next person.

Daak makes every handoff provable with a tap and a photo, has a sealed AI check the parcel at every stop, prices every delivery on a published meter, and splits the fee automatically among the drivers by kilometre. Drivers, shops and retailers never see a wallet or a token: amounts are rupees and payouts go to UPI.

## How it works

1. **Booking (x402 on Hedera).** The shop taps a new parcel. The shop's ordering agent books the delivery on `/api/book`, gets `402 Payment Required`, pays from its own Hedera account through the official x402 facilitator, and retries. Its spending controls allow HBAR only, at most 2 HBAR a booking, and only to Daak.
2. **The Daak meter.** The fee is Rs 5 + Rs 0.50 a km, so Kanpur to Gorakhpur (350 km) is Rs 180. The rate is printed on every booking.
3. **Escrow and the scheduled payout (Hedera, no Solidity).** The fee is locked in escrow as dINR, an HTS token for rupee credits with a 2% fractional custom fee that pays Daak at the network level. The payout to each driver, split by kilometre, is created at booking as a scheduled transaction and executes only when escrow signs it at delivery.
4. **The handoff (Android app).** At the bus stand, the driver taps the parcel's NFC sticker, taps the next driver's badge and photographs the lid. The phone adds its GPS fix. No signal? The handoff is signed and queued on the phone, and the payment waits.
5. **The check (0G).** The photo goes to a sealed (TeeML) vision model on 0G, `qwen3.7-plus`, which answers: right parcel, right stop, still sealed? If 0G cannot answer, the handoff is recorded as "tapped, not checked by AI" and the payment is held for a person to review. Nothing is faked.
6. **The record (Hedera HCS and Arkiv).** Every booking, handoff, payout, cash-out and Bachat deposit is a message on a public HCS topic. Consignments, handoffs and driver preferences are typed Arkiv entities; handoffs expire after a day. The retailer's tracking page and the operator dashboard read Arkiv.
7. **Delivery and pay.** When the last hop passes the check, escrow signs, the scheduled payout runs, and each driver's dINR is redeemed and sent to their UPI ID. Both references go on the HCS log.
8. **What drivers gain.** Bachat, an opt-in pot that keeps a share (5%) of every payout, recorded on chain. A work record computed only from the public HCS log (proven deliveries, km, clean rate) that unlocks a fuel advance (25% of the last 30 days' proven earnings, up to Rs 5,000). In production the pot and the advances sit with licensed partners.

## Live on testnet

| What | Id |
|---|---|
| HCS handoff log | [0.0.11327109](https://hashscan.io/testnet/topic/0.0.11327109) |
| dINR token (2% custom fee) | [0.0.11327356](https://hashscan.io/testnet/token/0.0.11327356) |
| Escrow account | [0.0.11327245](https://hashscan.io/testnet/account/0.0.11327245) |
| Daak operator and treasury | [0.0.11325722](https://hashscan.io/testnet/account/0.0.11325722) |
| Shop's sender agent | [0.0.11327358](https://hashscan.io/testnet/account/0.0.11327358) |
| x402 settlement (agent to Daak, 1 HBAR, fee paid by the facilitator 0.0.9185802) | [0.0.9185802-1793901050-675202430](https://hashscan.io/testnet/transaction/0.0.9185802-1793901050-675202430) |
| Executed scheduled payout | [schedule 0.0.11327387](https://hashscan.io/testnet/schedule/0.0.11327387) |
| Arkiv owner wallet (Rabdi) | `0x610FdB41DA83138615C317c89fd9EB09271a46fe` |

Deployed web app: https://web-ivory-delta-46.vercel.app (dashboard at `/`, tracking at `/track/<code>`).

## Layout

- `android/`: the Android app for shops, drivers and receivers. Kotlin, Jetpack Compose, NFC in reader mode, the system camera, GPS, Hindi text-to-speech, an offline outbox.
- `web/`: Next.js. The API (`/api/book`, `/api/pack`, `/api/handoff`, `/api/review`, `/api/track/[code]`, `/api/driver/[uid]`, `/api/consignments`), the operator dashboard and the tracking page. All sponsor keys stay here.
- `arkiv/`: how Daak uses Arkiv, its schema and the friction we hit.
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

`.env.local` needs: `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (ECDSA), `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`, `ZG_PRIVATE_KEY` (with mainnet 0G for the vision check), `DAAK_MASTER_SECRET`, and optionally the RazorpayX keys for UPI payouts.

## AI usage

See `AI_USAGE.md` for how AI tools were used, file by file.

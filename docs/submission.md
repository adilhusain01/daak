# Submission text (draft for the ETHGlobal form)

## Name

Daak

## Short description

Proof of handoff and fair pay for parcels relayed across buses in UP and Bihar: a tap, a photo and a sealed AI check at every stop, drivers paid by the kilometre straight to UPI.

## Description

In UP and Bihar, manufacturers send parcels to small-town shops on buses, often across two buses with a driver-to-driver handoff at a bus stand. Nobody signs at the handoff, every driver quotes a different rate, drivers are paid in cash with no record of their work, and when a parcel arrives torn, everyone blames the next person.

Daak puts a meter, a receipt and a payout on the network that already runs. A shop taps a new parcel with its Android phone, picks the receiver, the best-rated driver for each stretch and the weight, and its agent pays the exact booking over x402 on Hedera from the shop's prepaid rupees. At every bus stand, the driver taps the parcel's NFC sticker, taps the next person's badge and photographs the lid; the phone signs the handoff with a key in its secure hardware and adds GPS. A sealed vision model on 0G checks the photo: right parcel, right stop, still sealed. If 0G cannot answer, the handoff is recorded as "not checked by AI" and the money waits; nothing is faked.

Each driver gets 50, 70 or 90% of their stretch's pay the moment the next person confirms the handover (more as their public record grows) and the rest after delivery, held in a Hedera scheduled transfer that releases itself unless the shop files a claim; then the responsible driver's held pay repays the shop. Pay is redeemed to UPI. Drivers can save in Bachat and unlock fuel advances from their proven record. The receiving shop tracks the parcel by tapping it with any phone. Nobody sees a wallet or a token.

Live on testnet: https://daak-ethglobal.vercel.app (every delivery read-only at `/live`, the network map at `/network`).

## How it's made

- Android app in Kotlin and Jetpack Compose: NFC reader mode, the system camera, GPS, Hindi first with text-to-speech, an offline outbox, a P-256 key in the Android Keystore that signs every handoff.
- Next.js 16 on Vercel for the API and the web pages; no database: Arkiv is the store.
- Hedera with the JavaScript SDK and no Solidity: x402 bookings settled in dINR (our HTS rupee-credit token with a 2% fractional custom fee) through the official facilitator, per-shop agent accounts with spend controls and catalogue discovery, escrow, advances, holdbacks as long-term scheduled transactions (waitForExpiry) that execute themselves, refunds by deleting the schedule, an HCS topic as the public log, the mirror node for balances and work records.
- 0G compute for a sealed (TeeML) vision check with a 12 second budget and a safe-stop, and 0G Storage for the decision log.
- Arkiv for people, bookings, handoffs, daily orders and preferences, with expiry; Swarm for the lid and ID photos, encrypted, with the reference sealed before it reaches Arkiv.
- Data for the network map: India Post's pincode directory (GODL-India), OpenStreetMap bus stations (ODbL), OSRM road routes.
- Hacky bits: the meter charges road km taken from OSRM; the holdback release needs no server at all, because the schedule waits for its own expiry.

## Partner prizes

### Hedera: AI Agents That Pay (x402), No Solidity

How we used it: every booking is an x402 payment. Each shop has its own agent, a Hedera account holding the shop's prepaid rupees (dINR, topped up by UPI with the UTR on the HCS log). The agent reads `/.well-known/x402`, calls `/api/book`, gets a 402 quoting the exact booking (meter for the distance and weight plus a 12% booking fee), pays in dINR through the official facilitator, and retries; no person approves it. Spend controls: only dINR, at most Rs 2,000 a booking, only to Daak. Identity: both sides carry an HCS-14 UAID (verified against Hashgraph Online's SDK); the agent checks Daak's before paying and its own is recorded with each booking on HCS. After payment: escrow (HTS), advances on each confirmed handover, holdbacks in a long-term scheduled transaction that releases itself, deletion on a claim, HCS for every event, mirror node for records. Settlement example: `0.0.9185802-1793921489-636560474`. Hedera Agent Kit: the operator's "Ask Daak" assistant reads balances, HCS messages and transaction records through the Agent Kit's query plugins (Vercel AI SDK adapter, Cloudflare Workers AI model); it proposes, a person confirms, and every question is audited on HCS.

Feedback: x402 with an HTS token worked first time through the official facilitator, which surprised us; a line in the docs that custom HTS tokens settle would help others. `waitForExpiry` scheduled transactions are a superb primitive for escrow with a dispute window; we had to test that they execute on their own because the docs do not say it plainly. The SDK pinned by `@x402/hedera` (`@hiero-ledger/sdk`) differs from `@hashgraph/sdk`, which confused imports.

### 0G: Physical AI

How we used it: the phone is the body (NFC, camera, GPS, the person at the bus stand); 0G is the decision at each checkpoint. The handoff API sends the lid photo to a sealed TeeML vision model and acts on its answer: green releases that driver's advance; held stops the money. Every decision with its request id is written to 0G Storage (`web/lib/zgstore.ts`). During the event 0G had no sealed vision provider live and our compute account had no credits, so every handoff so far took the safe-stop path; _replace this line with the first request id and root hash once it runs_. Safe-stop: after 12 seconds or any error the handoff is recorded as "not checked by AI", the payout waits, and "Recheck with 0G" sends the encrypted photo from Swarm once 0G answers. What breaks without 0G: the money only moves on a person's review. A labelled, unsealed backup model may look at the photo when 0G is down, but it can only hold a payment, never release one; 0G's sealed recheck has the final word.

Feedback: _fill in after the credits land_ (the provider list changed during the event; the safe-stop carried us through it).

### Arkiv: Build on Arkiv (from scratch) + Swarm bonus

How we used it: Arkiv is Daak's only database: people (with sealed private fields), bookings, handoffs (expire after a day), daily orders, preferences. The tracking page, `/live`, the drivers page and the app all read from it. Lid and ID photos are on Swarm, encrypted; the reference is sealed before it goes into the entity. See `/arkiv/*.md` and `web/scripts/arkiv-query.mts`.

Feedback: see `/arkiv/friction.md` (str 128-byte limit, index lag after a write, ordering by an unindexed column silently returns nothing, `i32` and half rupees, the empty access key for the public endpoint).

## Links

- Live: https://daak-ethglobal.vercel.app
- Repo: https://github.com/adilhusain01/daak
- HCS log: https://hashscan.io/testnet/topic/0.0.11327109
- Demo video: _after recording_

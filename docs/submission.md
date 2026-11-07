# Submission text (draft for the ETHGlobal form)

## Name

Daak

## Short description

Proof of handoff and fair pay for parcels relayed across buses in UP and Bihar: two phones sign every handoff, a sealed AI checks the lid, and drivers are paid by the kilometre at the handover.

## Description

In UP and Bihar, manufacturers send parcels to small-town shops on buses, often across two buses with a driver-to-driver handoff at a bus stand. Nobody signs at the handoff, every driver quotes a different rate, drivers are paid in cash with no record of their work, and when a parcel arrives torn, everyone blames the next person.

Daak puts a meter, a receipt and a payout on the network that already runs. A shop taps a new parcel with its Android phone, picks the receiver and the best-rated driver for each stretch, enters the parcel's weight and size (priced on every charged kg, so each driver's pay follows the parcel), and its agent pays the exact booking over x402 on Hedera from the shop's prepaid rupees. Drivers join with their Google account; no wallet, no sticker. At every bus stand, the driver taps the parcel's NFC sticker, scans the next person's code (a QR their phone signs, good for two minutes and once) and photographs the lid, so both phones sign the handoff with keys in their secure hardware, and GPS is added. With only one phone, the next person taps their badge instead. A sealed vision model on 0G checks the photo: right parcel, right stop, still sealed. If 0G cannot answer, the handoff is recorded as "not checked by AI" and the money waits; nothing is faked.

Each driver gets 50, 70 or 90% of their stretch's pay the moment the next person confirms the handover (more as their public record grows) and the rest after delivery, held in a Hedera scheduled transfer that releases itself unless the shop files a claim; then the responsible driver's held pay repays the shop. Pay is redeemed to UPI. Drivers can save in Bachat and unlock fuel advances from their proven record, and vouch for new drivers on their corridor, staking their own record on it. IDs are read by the same sealed AI before an operator verifies them. Every booking pays its own share of the AI checks: 2% of its fee on Hedera, the same value in 0G into Daak's own compute account. The receiving shop tracks the parcel by tapping it with any phone. Nobody sees a wallet or a token.

Live on testnet: https://daak-ethglobal.vercel.app (every delivery read-only at `/live`, the network map at `/network`).

## How it's made

- Android app in Kotlin and Jetpack Compose: NFC reader mode, the system camera, GPS, Hindi or English with Hindi text-to-speech, an offline outbox, a P-256 key in the Android Keystore that signs every handoff. People sign in with Google (Credential Manager, token verified on the server) or a badge; at a handoff the other person shows a QR their phone signs, so both phones sign, with a badge tap as the one-phone fallback; vouching by scanning a newcomer's code.
- Next.js 16 on Vercel for the API and the web pages; no database: Arkiv is the store.
- Hedera with the JavaScript SDK and no Solidity: x402 bookings settled in dINR (Daak's HTS rupee-credit token with a 2% fractional custom fee) through the official facilitator, per-shop agent accounts with spend controls and catalogue discovery, escrow, advances, holdbacks as long-term scheduled transactions (waitForExpiry) that execute themselves, refunds by deleting the schedule, an HCS topic as the public log, the mirror node for balances and work records.
- 0G compute for a sealed (TeeML) vision check in private, TEE-only mode, with a 20 second budget and a safe-stop, and 0G Storage for the decision log; Daak's own 0G Direct compute account, topped up by every booking, pays for the checks.
- Arkiv for people, bookings, handoffs, daily orders and preferences, with expiry; Swarm for the lid and ID photos, encrypted, with the reference sealed before it reaches Arkiv.
- Data for the network map: India Post's pincode directory (GODL-India), OpenStreetMap bus stations (ODbL), OSRM road routes.
- The landing page's one-minute hero film is rendered in code by raea (React on Bevy) as cut paper, with its captions laid over it from the same timeline.
- Hacky bits: the meter charges road km taken from OSRM; the holdback release needs no server at all, because the schedule waits for its own expiry.

## Partner prizes

### Hedera: AI Agents That Pay (x402), No Solidity

How I used it: every booking is an x402 payment. Each shop has its own agent, a Hedera account holding the shop's prepaid rupees (dINR, topped up by UPI with the UTR on the HCS log). The agent reads `/.well-known/x402`, calls `/api/book`, gets a 402 quoting the exact booking (meter for the distance and weight plus a 12% booking fee), pays in dINR through the official facilitator, and retries; no person approves it. Spend controls: only dINR, at most Rs 2,000 a booking, only to Daak. Identity: both sides carry an HCS-14 UAID (verified against Hashgraph Online's SDK); the agent checks Daak's before paying and its own is recorded with each booking on HCS. After payment: escrow (HTS), advances on each confirmed handover, holdbacks in a long-term scheduled transaction that releases itself, deletion on a claim, HCS for every event, mirror node for records. Settlement example from the full run KNP-3WAE9 (Rs 599.26 in dINR): `0.0.9185802-1793986788-181264432`. Hedera Agent Kit: the operator's "Ask Daak" assistant reads balances, HCS messages and transaction records through the Agent Kit's query plugins (Vercel AI SDK adapter, Cloudflare Workers AI model); it proposes, a person confirms, and every question is audited on HCS.

Feedback: x402 with an HTS token worked first time through the official facilitator, which surprised me; a line in the docs that custom HTS tokens settle would help others. `waitForExpiry` scheduled transactions are a superb primitive for escrow with a dispute window; I had to test that they execute on their own because the docs do not say it plainly. The SDK pinned by `@x402/hedera` (`@hiero-ledger/sdk`) differs from `@hashgraph/sdk`, which confused imports.

### 0G: Build with Private Computer, and Agents That Pay for Themselves

How I used it: a sealed 0G check is the step every user waits on. Shops and drivers use it for every parcel, and drivers come back because each handover pays them on the spot. What breaks without 0G: no handover pays until a person reviews the photo. The handoff API sends the lid photo through the 0G Router to a sealed TeeML vision model (`0gm-1.0-35b-a3b` on Intel TDX, provider `0xf4FB8d2bD856e672b5f9848b0eD235A20079B250`), pinned to a TEE-acknowledged provider and sent with `X-0G-Provider-Trust-Mode: private` so it can never fall back to an unsealed one, and acts on its answer: green releases that driver's advance; held stops the money. Every decision with its request id is written to 0G Storage (`web/lib/zgstore.ts`); first record on mainnet: root `0xe803a6bf264fe1e3855dcc87f18e7a0ec3151d025f15a902351ede32f61177e9`, tx `0xa90f5e64ebb33f64510f718c7c298373d6623235e48a52ea1519ed2f35ffb704`. **The agent pays for its own checks.** Daak has its own 0G compute account (0G Direct, opened with tx `0xa1135dbf50dae2140d0c1e21aabc7e36fec2e372abc9280bb957dd9987f009d7`) and asks the sealed provider from it first, verifying the provider's TEE signature on each answer; the Router credit is the fallback. Each booking pays its share: 2% of its booking fee moves in dINR on Hedera to a compute budget account, and the same value in 0G, at the live price, goes into the compute account; both transaction ids go on the HCS log with the booking (first one: Hedera `0.0.11325722@1793951959.279453219`, 44 paise; 0G `0x155619fe0b72df48ac06d0a647a3db260099f451892e937e2ebefbfabe91f6a2`, 0.032 0G). Only the currency exchange between the two chains is not on chain; in production a payment partner buys the 0G with the rupees. Capped at 1 0G a day (`web/lib/compute.ts`, `computeEarmark` in `web/lib/rules.ts`). First sealed checks on 6 Nov: a lid reading KNP-7115 matched (`chatcmpl-b30615d2-51da-4a79-a116-297ec5a7f45e`, 9.2 s) and the same photo against KNP-9999 was refused with "the code on the parcel is KNP-7115" (`chatcmpl-ff00a134-ea24-47ad-9c3e-237426d648b7`, 7.2 s). Safe-stop: after 20 seconds or any error the handoff is recorded as "not checked by AI", the payout waits, and "Recheck with 0G" sends the encrypted photo from Swarm once 0G answers. What breaks without 0G: the money only moves on a person's review. A labelled, unsealed backup model may look at the photo when 0G is down, but it can only hold a payment, never release one; 0G's sealed recheck has the final word. 0G also reads drivers' ID photos for the operator in the same sealed mode (ID type, name, last 4, whether a licence allows a bus, Aadhaar masking, signs of editing), so an ID never goes to an open model; only the receipt and pass or fail go on the public log. On 6 Nov the three held handoffs of KNP-1204 were rechecked by 0G at 11:28 (`chatcmpl-6eb1ede1…`, `chatcmpl-73f8e8bb…`, `chatcmpl-224ee09e…`) and its held pay released itself on Hedera at 11:44. On 7 Nov the full run KNP-3WAE9 was checked sealed at all three stands (`3213997c…`, `7b84fb39…`, `372eff24…`). The last stand was held at first: the code on the lid was written over two lines, and Daak's letter-for-letter compare called it a mismatch. I made Daak compare letters and digits only, 0G rechecked it green, and the pay went out.

Feedback: the Router worked first time with an OpenAI-compatible client, and private mode plus pinning a provider made it easy to guarantee a sealed answer. What cost me time: (1) on mainnet there was one sealed vision provider, and when it went down from about 12:40 on 6 Nov there was nothing to fail over to, so the safe-stop and a labelled backup carried the handoffs; (2) signing in to pc.0g.ai, even with MetaMask, creates a separate built-in wallet that holds the Router credit, so my server could not deposit into it, and I used Direct from my own wallet for the agent to pay for itself; (3) the setup script read the wallet balance (0) while the Router had credit, two pools that are easy to confuse; (4) Direct needs 3 0G to open an account and 1 0G per provider, and `getRequestHeaders` moved another 1 0G to the provider on its own; (5) the SDK prints transaction hashes instead of returning them. Bridging in was easy: the 0G Hub with LI.FI's GasZip turned 0.0008 ETH into native 0G in about a minute.

### Arkiv: Build on Arkiv (from scratch) + Swarm bonus

How I used it: Arkiv is Daak's only database: people (with sealed private fields), bookings, handoffs (expire after a day), daily orders, preferences. The tracking page, `/live`, the drivers page and the app all read from it. Lid and ID photos are on Swarm, encrypted; the reference is sealed before it goes into the entity. See `/arkiv/*.md` and `web/scripts/arkiv-query.mts`.

Feedback: see `/arkiv/friction.md` (str 128-byte limit, index lag after a write, ordering by an unindexed column silently returns nothing, `i32` and half rupees, the empty access key for the public endpoint).

## Links

- Live: https://daak-ethglobal.vercel.app
- Repo: https://github.com/adilhusain01/daak
- HCS log: https://hashscan.io/testnet/topic/0.0.11327109
- Demo video: _after recording_

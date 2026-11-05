# Decisions

Dates are IST. "Team" means Adil Husain and teammates; "assistant" means the AI coding assistant, whose proposals the team accepted or changed.

## Before hacking (planning only, no code)

- 4 Nov: the idea started as proof of handoff and split pay for relay delivery, demoed with Mumbai's dabbas; partners 0G (Physical AI, Agents That Pay for Themselves), Hedera (x402, No Solidity), Arkiv (from scratch, plus Swarm). Prior art checked: DeDe (ETHGlobal Istanbul 2023) and DeliverDAO prove a single courier, not multi-hop handoffs with a check per hop and split pay.
- 5 Nov, team: a phone instead of an ESP32 board; NFC stickers and cards instead of metal tins (cheaper, parts available the same day).
- 5 Nov, team: the real pain is parcels relayed across buses in UP and Bihar (manufacturer to wholesaler to small-town shop, often two buses and a driver-to-driver handoff). The product became Daak.

## During the hackathon

- 5 Nov 21:00: repo created; code starts.
- 5 Nov, team: a native Android app (Kotlin) after Chrome's Web NFC flickered on the phone; minimal, in the style of the team's earlier apps.
- 5 Nov, team: drivers are paid for kilometres travelled (GPS at start and end), not a flat fee per parcel. This became the Daak meter: Rs 5 + Rs 0.50 a km.
- 5 Nov, team: drivers, shops and receivers never see web3. Nothing on chain is cut to achieve that ("for them it's easy").
- 5 Nov, team: payouts go to UPI. RazorpayX refused an individual account, so the operator pays by UPI QR and records the bank reference (UTR) on the Hedera log until a licensed payout partner is connected.
- 5 Nov, team: an opt-in Bachat savings pot and fuel advances from proven work history, because drivers opt in for "free income" and a record that makes them findable ("Porter, but for drivers").
- 5 Nov, team: do not block on the 0G outage; cap the wait, keep the safe-stop, recheck automatically when 0G is back.
- 6 Nov, team: look at the whole lifecycle from each person's side (joining, choosing drivers, pickup, to-do lists, disputes).
- 6 Nov, team (after a judge-perspective review the team asked for): passcode on the dashboard, an app key, joined-only routes, a booking cap, handoffs signed in the phone's secure hardware.
- 6 Nov, team, from a conversation with a builder at the event: start with daily, predictable B2B goods on one corridor moving off-peak; show real money moving; map India Post's office tree and the bus network.
- 6 Nov, team: drivers take part of their pay at the handover and the rest only when the parcel is delivered, so they stay liable; the held part repays the customer on loss or damage. Assistant proposed tiers by record (50, 70, 90%), a 24-hour self-releasing holdback and a capped protection pool; team accepted.
- 6 Nov, team: the booking fee is a percentage of the meter, not a flat Rs 10 (12%, at least Rs 5).
- 6 Nov, team: build order split payout, map, standing orders, weight.
- 6 Nov, team: drivers join with bus number and operator, mobile, and a government ID for KYC. Assistant: driving licence first, Aadhaar only masked, keep the last 4 characters only (Aadhaar rules).
- 6 Nov, team: the map follows the road, not straight lines, and covers all of India so the major hubs show; the meter charges road kilometres.
- 6 Nov, team: full page width on the website, and the app tidied the same way.
- 6 Nov, team: a review of everything against the live prize and rules pages; every gap became a task in `TASKS.md`.

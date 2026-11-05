# Daak: market, starter, funnel and numbers

Working notes for the pitch. Sourced figures carry their source; everything else is an assumption, marked as one, to be replaced by real numbers from the pilot.

## What the meeting changed

Notes from a conversation with a builder at ETHGlobal Mumbai (5 to 6 November 2026):

1. **The river is already flowing.** Buses, routes and drivers already exist, and parcels already ride them. Daak does not onboard a fleet; it puts a meter, a receipt and a payout on a network that already runs ("you just install the dam").
2. **Start with goods that move every day, predictably.** Demand you can forecast within about ±10% (groceries, daily perishables) builds a business; demand that swings ±50% (medicines) does not, because stock either rots or runs out.
3. **Off-peak capacity is the supply.** Perishables move before 5 am, when traffic and passengers are low. Non-AC state buses that have met their passenger target by early afternoon just finish the route, with room to spare.
4. **The hidden wallet, with a holdback.** The sender pays up front and the platform holds every driver's cut. Today a bus driver asks for the full amount at handover. With Daak's perks (priority, a record, advances, more parcels) he agrees to take part of it, about half, when the next person confirms receipt, and the rest only when the parcel reaches its destination and is confirmed. That keeps him liable until the end: if the parcel is lost or damaged, the held part goes to repay the customer, as far as it covers. A lost parcel traces to the last confirmed handover.
5. **Driver incentives.** A profile and rating, as on delivery apps: good drivers get priority; pay is a share of every parcel carried, so more parcels mean more income.
6. **Show real money moving.** Ten parcels in ten cities with real payments beats any projection. Partner with courier franchises and bus operators to get there.
7. **The network is mapped already.** India Post's office tree (branch office, sub office, head office, sorting hubs) is a relay network, and its data is public.

Daak now does 1, 5 and all of 4: 50% at handover for a new driver, 70% after 10 clean deliveries, 90% after 50 with 98% clean; the holdback releases itself on chain 24 hours after delivery, and on loss or damage the liable leg's holdback repays the customer, topped up by a protection pool (1 point of the booking fee, capped at Rs 2,000). To add: weight in the meter, standing orders, the map.

## The starter (beachhead)

**Daily, time-sensitive B2B consignments on one bus corridor, moving off-peak.** Examples to validate: flowers and leaves for temples, caterers and restaurants; dairy (paneer, khoya) from producing towns to city sweet shops; bakery and fresh produce to small-town stores.

Why this first:

- **Consistent volume:** the same sender ships to the same receivers every day, so volume is forecastable and pitchable as monthly recurring revenue.
- **Proof matters most here:** perishables arrive late, crushed or short, and today nobody can say at which handoff it happened.
- **Spare capacity:** early-morning and post-target buses carry them without displacing passengers.
- **Low theft risk, high spoilage cost:** what decides is speed and the record, not security guards.

The corridor: Kanpur to Lucknow to Gorakhpur for the story; the first live pilot wherever the team can run it this weekend.

## The funnel

| Stage | Who | How they come in | Why they stay |
|---|---|---|---|
| Supply | Bus drivers and conductors on the corridor | Met at the depot or bus stand; join by tapping a badge | Part of the pay at each handover, the rest at delivery; a public work record, Bachat, fuel advances, priority for good records |
| Seed demand | Senders with a daily standing order | Through bus booking agents and WhatsApp trade groups | One meter rate, a photo at every handoff, no phone calls to chase drivers |
| Free side | Receiving shops | Come with each sender; tap the parcel with any phone | Live tracking and proof of condition on arrival |
| Expansion | Courier franchises (DTDC-style) and bus operators | Use Daak for the bus-carried legs of their own network | Fewer disputes, a record per leg, payouts handled |
| Later | Lenders and insurers | Read the public work record | Underwrite advances and per-hop cover |

## Unit economics per parcel (assumptions)

| Line | Value | Basis |
|---|---|---|
| Average distance | 150 km | assumption: one or two legs |
| Meter (to drivers) | ₹5 + ₹0.50 × 150 = **₹80** | Daak's published meter |
| Daak booking fee | 12% of ₹80 = **₹9.60** | 12% of the meter, at least ₹5 (configurable) |
| Daak cut on payout | 2% of ₹80 = **₹1.60** | built into the dINR token |
| **Sender pays** | **₹89.60** | |
| **Daak revenue** | **₹11.20** (about 12.5% of GMV) | |
| Chain cost (Hedera, Arkiv, Swarm) | under ₹1 | assumption; Hedera fees are fractions of a cent per transaction |
| 0G check | under ₹1 | assumption, to measure once 0G works |
| UPI payout and SMS | about ₹3 | assumption; depends on the payout partner |
| **Contribution per parcel** | **about ₹6.50** | |

## Projection (illustrative, to be replaced by pilot data)

| Stage | Corridors | Parcels a day | GMV a month | Daak revenue a month |
|---|---|---|---|---|
| Pilot (month 1) | 1 | 30 (3 senders × 10) | ₹80,600 | ₹10,100 |
| Month 6 | 10 | 1,000 | ₹26.9 lakh | ₹3.4 lakh |
| Month 12 | 40 | 6,000 | ₹1.61 crore | ₹20.2 lakh (₹2.4 crore a year) |

Revenue = parcels a day × 30 × ₹11.20; GMV = parcels a day × 30 × ₹89.60. The booking fee scales with distance, so longer corridors earn more per parcel. Fintech (advances, Bachat partner fees) is upside and not counted.

The consistency argument: standing orders make the daily count predictable, so each new corridor adds a known block of volume rather than a hope.

## Market context (sourced, from earlier research)

- Part truckload, the relay-shaped freight where goods change hands, about USD 23.3 billion in India in 2025, 9.7% a year (MarkNtel, Report Cubes).
- Courier, express and parcel USD 8.6 to 16.9 billion in 2025 by source (Mordor, IMARC, Expert Market Research).
- Nobody measures parcels carried on buses: that slice has no records, which is the point.
- Comparables in 2026: Porter about USD 1.2 billion; BlackBuck about ₹10,000 crore market cap, valued for owning the trucker relationship.

## The map

India Post's office tree plus the state bus network, on one map: every head office as a hub, sub and branch offices around it, bus depots and corridors between them, and Daak's live routes on top. It shows the network already exists and where Daak goes next.

Live at `/network`. Data:

- **Post offices:** the All India Pincode Directory (Department of Posts, data.gov.in, GODL-India): 807 head offices, 24,278 sub offices and 1,18,524 branch offices with usable coordinates across 36 states and union territories (1,03,434 distinct points on the map).
- **Buses:** 6,021 bus stations tagged on OpenStreetMap (ODbL). UPSRTC runs 115 depots (Wikipedia, redBus); no official GTFS feed exists.
- **The corridor:** drawn along the driving route on OpenStreetMap roads (OSRM). By road, Kanpur to Lucknow is 87 km and Lucknow to Gorakhpur 272 km; the meter currently charges 80 and 270.

## Traction before Saturday

- Five real paid deliveries in Mumbai between teammates or friends, each a real ₹ UPI payment with its UTR on the Hedera log.
- Two or three senders who say on record (a message or a clip) that they would use it, with their daily volume.
- One bus parcel booking office conversation.

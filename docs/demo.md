# Demo: the video, the live pitch, the questions

## The submission video (target 2:45)

Rules that shape it: 2 to 4 minutes (0G wants under 3), at least 720p, recorded on a laptop not a phone (film the phone with a second device or mirror it with scrcpy), a real voice (no AI voice, no music over captions in place of speaking), intro under 20 seconds, at most 4 bullets a slide, a settled payment on HashScan (Hedera), the Swarm moment (note its timestamp in `arkiv/swarm.md`).

| Time | On screen | Said (by a teammate, in your own words) |
|---|---|---|
| 0:00 to 0:15 | A bus stand photo or the network map, then the title | "Parcels from Kanpur reach Gorakhpur on two buses. Nobody signs when one driver hands to the next, every driver charges a different rate, and when it arrives torn, nobody is responsible. This is Daak." |
| 0:15 to 0:45 | Shop's phone: tap the parcel, choose receiver, drivers, weight; price and balance; Book | "The shop taps a parcel and sees the exact price on our published meter, Rs 5 plus 50 paise a km, times the weight. Its agent pays from the shop's prepaid rupees over x402 on Hedera, with no one approving it." |
| 0:45 to 1:00 | HashScan: the x402 settlement in dINR, the HCS "booked" message | "Here is that payment settled on Hedera, and the booking on our public log." |
| 1:00 to 1:40 | Driver's phone: job offer accepted; at the stand tap parcel, tap badge, photo; the verdict | "The driver accepted the job. At Lucknow he taps the parcel, the next driver's badge and photographs the lid. The phone signs it. A sealed AI on 0G checks it: right parcel, right stop, still sealed. If 0G can't answer, the money waits; we never fake the check." |
| 1:40 to 2:05 | `/live`: paid at handover and held; HashScan advance; the holdback schedule | "He got half his pay right away, to UPI. The rest is held on Hedera until delivery and releases itself; if the parcel arrives damaged, his held pay repays the shop." |
| 2:05 to 2:20 | Dashboard: open the lid photo (Swarm), Arkiv record | "Photos are encrypted on Swarm, records live on Arkiv and expire when nobody needs them." |
| 2:20 to 2:40 | Driver's home: record, tier, Bachat, fuel advance; the network map | "Every proven handoff builds a record drivers own: more pay up front, savings, fuel advances. India Post and the buses already built the network; we put a meter on it." |
| 2:40 to 2:45 | Title and URL | "Daak. daak-ethglobal.vercel.app." |

## The live pitch (4 minutes, then 3 of questions)

1. 0:00 to 0:30, the problem, one slide: two buses, one handoff, no receipt, cash pay.
2. 0:30 to 2:45, the live demo with two phones and the stickers, the same order as the video. Have `/live` and HashScan open in tabs before you start. If 0G is down, say so and show the safe-stop: that is part of the design.
3. 2:45 to 3:30, the business, one slide: daily B2B on one corridor first (dairy, flowers, bakery), Rs 11.20 revenue on an Rs 89.60 booking, the funnel through bus booking offices, then courier franchises.
4. 3:30 to 4:00, the ask and the close: pilot on one UP corridor with five senders; "Porter, but for the buses that already run".

Slides, at most four bullets each: problem, how it works (one diagram), business, ask.

## Questions to prepare

- **Why a blockchain?** Three parties who do not trust each other's software (shop, two drivers, often two bus operators) need one record nobody owns and a payout nobody can hold back. The record and the payout rules are public; anyone can recompute a driver's history.
- **What if 0G is down?** Safe-stop: recorded, money held, rechecked automatically from the encrypted photo. We never invent a verdict.
- **Can a driver fake a handoff?** Both badges must be tapped, the phone signs with a key in its secure hardware, GPS must be within 500 m of the stand (off for the Mumbai demo, `STAND_RADIUS_M=0`, since the stands are in UP), and the photo must show the code.
- **Who holds the money? Is that legal?** Today the shop prepays rupee credits; in production collections and escrow sit with a licensed payment aggregator's nodal account, Bachat with a partner bank, advances with an NBFC. Daak is the software and the record.
- **Do bus operators allow this?** Parcels already ride these buses. The pitch to UPSRTC is a share of a new, recorded revenue line at their parcel desks instead of cash that never reaches them.
- **Margin?** About Rs 6.50 contribution per parcel after UPI and chain costs; it is a volume business, which is why daily standing orders come first.
- **Moat?** The drivers' portable work records and the corridor's handoff data; every proven handoff makes a driver easier to find and a lender likelier to fund them.
- **What about drivers without NFC phones?** One phone at the stand's booking counter can run every handoff there; badges are cards.

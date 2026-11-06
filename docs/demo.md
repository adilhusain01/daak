# Demo: the video, the live pitch, the questions

## Before recording or going on stage

- Phones: the shop's phone and two drivers' phones (or one phone, switching with Me → Switch badge). App language on English for the video (Me → Language).
- Tabs open on the laptop: `/live`, `/ops` (signed in), HashScan for topic `0.0.11327109`, and the KNP-1204 page on `/live` as the fallback story if anything stalls.
- `STAND_RADIUS_M=0` is set (the stands are in UP). `DATA_SINCE` set to the start of the clean run, so test bookings do not show.
- 0G: if the sealed provider is down, a handoff says "waiting for the check" and the money waits. Say so on camera; it is the design. Recheck in `/ops` once it is back.
- Each stop needs a new lid photo; the server refuses a photo it has seen.

## The submission video (target 2:45)

Rules that shape it: 2 to 4 minutes (0G wants under 3), at least 720p, recorded on a laptop (show the phone with scrcpy or a second camera, not by recording on the phone), a real voice (no AI voice, no music over captions instead of speaking), intro under 20 seconds, at most 4 bullets a slide, a settled payment on HashScan (Hedera), the Swarm moment (note its timestamp in `arkiv/swarm.md`).

| Time | On screen | Said (by a teammate, in your own words) |
|---|---|---|
| 0:00 to 0:15 | The landing page's night road (or the film), then the title | "Parcels from Kanpur reach Gorakhpur on two buses. Nobody signs when one driver hands to the next, every driver charges a different rate, and when it arrives torn, nobody is responsible. This is Daak." |
| 0:15 to 0:40 | Shop's phone, Book: tap the parcel, receiver, drivers with their bus times, weight, price and balance; Book | "The shop taps a parcel and sees the exact price on our published meter, Rs 5 plus 50 paise a road kilometre. Its own agent pays over x402 on Hedera, from the shop's prepaid rupees, with nobody approving it." |
| 0:40 to 0:50 | HashScan: the x402 settlement in dINR; the HCS "booked" message with the agent's ID | "Here is the payment settled on Hedera, and the booking on our public log, with the agent's identity." |
| 0:50 to 1:00 | Driver's phone: signed in with Google; the job offer with stretch, km and pay; Accept | "The driver joined with his Google account, no sticker needed, and gets the job with what he earns at the handover." |
| 1:00 to 1:35 | At the stand: tap the parcel; the next driver opens Show my code; scan it; lid photo; the verdict "both phones signed" | "At Lucknow he taps the parcel and scans the next driver's code: both phones sign this handoff. The photo goes to a sealed AI on 0G that checks the code on the lid. If 0G cannot answer, the money waits; we never fake the check." |
| 1:35 to 1:55 | `/live/<code>`: paid at the handover and held; the advance on HashScan | "He was paid half his stretch the moment the handover was confirmed. The rest is held on Hedera until delivery, so if the parcel arrives torn, his held pay repays the shop." |
| 1:55 to 2:15 | KNP-1204's holdback schedule executed at 11:44; the `daak.compute` entry on HCS with its Hedera and 0G transactions | "At delivery the held pay releases itself, with no server. And every booking pays its own share of the AI checks: 2% of its fee on Hedera, the same value in 0G into Daak's own compute account." |
| 2:15 to 2:30 | `/ops`: an ID read by 0G; a vouch on a driver's record; the lid photo from Swarm; the Arkiv record | "IDs are read in the same sealed machine. Drivers vouch for each other and stake their own record on it. Photos are encrypted on Swarm, records live on Arkiv." |
| 2:30 to 2:45 | The driver's record and tier, the network map, the URL | "Every proven handoff builds a record the driver owns: more pay up front, savings, fuel advances. The buses already built the network; we put a meter on it. Daak." |

## The live pitch (4 minutes, then 3 of questions)

1. 0:00 to 0:30, the problem, one slide: two buses, one handoff, no receipt, cash pay.
2. 0:30 to 2:45, the live demo, same order as the video: book on the shop's phone, a two-phone handoff by code, the verdict, `/live` showing the advance and the held pay. Have `/live` and HashScan open before you start. If 0G is down, show the safe-stop and KNP-1204, which 0G rechecked and paid.
3. 2:45 to 3:30, the business, one slide: daily B2B on one corridor first (dairy, flowers, bakery), Rs 22.14 booking fee on a Rs 184.50 parcel plus 2% of every payout, the funnel through bus booking offices, then courier franchises.
4. 3:30 to 4:00, the ask and the close: a pilot on one UP corridor with five senders; "Porter, but for the buses that already run".

Slides, at most four bullets each: problem, how it works (one diagram), business, ask. Built: https://daak-ethglobal.vercel.app/pitch (arrow keys or a click move on, F is full screen) and `docs/pitch.pdf` (1920 by 1080, one slide a page).

## Questions to prepare

- **Why a blockchain?** Three parties who do not trust each other's software (shop, two drivers, often two bus operators) need one record nobody owns and a payout nobody can hold back. The record and the payout rules are public; anyone can recompute a driver's history.
- **What if 0G is down?** It happened during the event. The handoff is recorded and signed, a labelled backup model can hold a payment but never release one, and "Recheck with 0G" sends the encrypted photo once 0G answers. KNP-1204 went exactly this way: held in the morning, rechecked by 0G at 11:28, paid in full by its own schedule at 11:44.
- **Can a driver fake a handoff?** Both people's phones sign it when the other person shows their code (a QR their phone signs, good for two minutes and once). Each phone's key sits in its secure hardware. The photo must show the code, and GPS must be within 500 m of the stand (off for the Mumbai demo, since the stands are in UP). A sticker's ID can be copied, which is why the code, not the badge, is the strong path.
- **Drivers without stickers or NFC?** Drivers join with their Google account; at a handover the other person's code stands in for a badge. Parcels keep their sticker, and the code is also written on the lid.
- **How do you know an ID is real?** Today the operator decides, after 0G reads the photo in a sealed machine (name, last 4, licence class, masking, edits). The production path is DigiLocker: a government-signed licence or Aadhaar instead of a photo.
- **Can drivers collude on vouches?** A vouch costs the voucher: three in 30 days at most, and none for 90 days after someone they vouched for is found responsible for a damaged parcel. The operator still decides on IDs.
- **Why not World ID?** It is on the roadmap as "one human, one driver record". Few drivers on rural routes can reach an Orb today, and the ID check does the job meanwhile.
- **Does the agent really pay for itself?** Each booking moves 2% of its fee in dINR on Hedera to a compute budget, and the same value in 0G goes into Daak's own 0G compute account, which pays the sealed provider. Both transactions are on the public log with the booking. The currency exchange between them is the one step not on chain; in production a payment partner does it.
- **Who holds the money? Is that legal?** Today the shop prepays rupee credits; in production collections and escrow sit with a licensed payment aggregator's nodal account, Bachat with a partner bank, advances with an NBFC. Daak is the software and the record.
- **Do bus operators allow this?** Parcels already ride these buses. The pitch to UPSRTC is a share of a new, recorded revenue line at their parcel desks instead of cash that never reaches them.
- **Margin?** About Rs 7 contribution per parcel after UPI, chain and AI-check costs (a sealed check is priced at about Rs 0.01); it is a volume business, which is why daily standing orders come first.
- **Moat?** The drivers' portable work records, the vouches between them, and the corridor's handoff data; every proven handoff makes a driver easier to find and a lender likelier to fund them.

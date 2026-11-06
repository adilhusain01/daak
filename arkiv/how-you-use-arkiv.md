# How Daak uses Arkiv

Arkiv is Daak's only database. There is no Postgres and no server disk: the Vercel functions are stateless, and every piece of state the app needs lives as a typed Arkiv entity (`web/lib/arkiv.ts`; the full table is in `schema.md`).

What users see, read from Arkiv:

- **The receiving shop's tracking page** (`/track/<code>`) reads the consignment and its handoffs: where the parcel is, the next stop, the proof of each handoff.
- **The drivers page** (`/drivers`) lists every driver from their `daak.badge` entity (bus, stretches, ID checked) and ranks them by the record on the Hedera log.
- **The app** signs a person in by reading their badge, plans a booking from the drivers who run each stretch (the `legs` column), shows each driver their to-do list and each shop its daily orders.
- **The operator dashboard** lists recent consignments ordered by `createdAt`, each one's handoffs, the drivers waiting for an ID check, and the daily orders.

What Daak writes:

- **People.** Joining writes a `daak.badge`: name, role, bus and stretches in the clear; phone, UPI ID and the ID details sealed. Later patches add the phone's signing key (`devicePub`) and the operator's ID decision (`kycStatus`), in place with `patchEntity`.
- **The booking.** When the shop's agent pays over x402, the consignment (route, km per leg, each driver's share at handover, fee in paise, weight: a band, or the measured parcel as `kg:24|60x50x40`) is written before any money moves, so a failed write never strands money in escrow.
- **Each handoff.** The handoff API finds the parcel's newest consignment by its NFC serial (an indexed column), reads which hops are done, and writes the new handoff with the 0G verdict, the HCS sequence, the photo hash, the GPS point and the sealed Swarm reference of the lid photo.
- **Daily orders.** A `daak.standing` entity per repeat booking. The 04:00 IST run reads the active ones, books those due, and patches `lastRun` and `lastCode`; when the shop taps that day's parcel, the consignment's `parcel` column is patched from a placeholder to the real tag.
- **Driver preferences.** Bachat on or off; the payout reads the newest one.

Expiry is part of the design: a handoff record is needed for the day the parcel travels, then it expires. People, bookings and daily orders last 30 days. Nobody needs a permanent map of who carried whose parcel; the permanent, minimal proof is the Hedera log, which holds only hashes.

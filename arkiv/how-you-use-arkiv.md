# How Daak uses Arkiv

Arkiv is Daak's only database. There is no Postgres and no server disk: the Vercel functions are stateless, and every piece of state the app needs lives as a typed Arkiv entity.

- **The booking.** When the shop's agent pays for a booking, the consignment (route, km per leg, fee, the Hedera schedule that will pay the drivers) is written to Arkiv.
- **Each handoff.** The handoff API finds the parcel's newest consignment by its NFC serial (an indexed column), reads which hops are already done, and writes the new handoff with the 0G verdict, the HCS sequence, the photo hash and the GPS point.
- **The retailer's tracking page** (`/track/<code>`) reads the consignment and its handoffs straight from Arkiv. This is the feature users see.
- **The operator dashboard** lists recent consignments ordered by `createdAt` and each one's handoffs.
- **Driver preferences** (Bachat on or off) are entities too; the payout reads the newest one.

Expiry is part of the design: a handoff record is needed for the day the parcel travels, then it expires. Nobody needs a permanent map of who carried whose parcel; the permanent, minimal proof is the HCS log.

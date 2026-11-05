# Why Arkiv

- **Records that should not live forever.** Handoff details (where a driver stood, a photo hash, which badge took the parcel) are needed while the parcel moves and for a short dispute window, not for ever. Arkiv's expiring entities match that; a database would keep them until someone remembers to delete them, and a chain would keep them for ever.
- **Queryable, unlike a log.** The HCS log proves order and existence; Arkiv lets the tracking page ask "every handoff for KNP-6377" or "the newest booking for this NFC serial" with indexed, typed columns.
- **Shared without a shared server.** A bus operator, a shop and a retailer do not trust each other's databases. Arkiv records owned by one publisher wallet can be read by anyone, so any of them can build their own view.
- **No backend to run.** Daak's web app runs on stateless Vercel functions with Arkiv as the store.

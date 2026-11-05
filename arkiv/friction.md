# Friction we hit with Arkiv

Honest notes from building Daak in one night on SDK 1.0.1 and Rabdi.

1. **`str` columns stop at 128 bytes.** Our consignment's route (JSON of the legs) failed with `InvalidValueError ... exceeds the 128-byte limit on a str`. The error message was excellent: it told us to use a `bytes` column, which we did for the route and for the human-readable reason. It would help to say the limit next to `str()` in the README's schema section.
2. **A fresh write is not in queries for a few seconds.** A booking written and then queried by its parcel serial two seconds later came back empty, so the first handoff of a parcel failed. We added a retry (up to 10 s). A note in the docs on expected index lag, or a "read your own write" option, would save this.
3. **An unscoped query errors.** `select().limit(1).fetch()` with no schema and no filter threw; adding `.ownedBy(...)` fixed it. A clearer message ("add a filter or a schema") would help a first-time user.
4. **Optional columns are the way to evolve a schema.** Adding `geo` to handoffs worked because we made it `.optional()`; old rows still read. Worth a line in the docs, since a required new column silently skips old rows.
5. **What was smooth:** typed schemas and the query builder caught our mistakes at compile time, the access key and faucet took two minutes, and expiry needed one line (`ExpirationTime.fromDays(1)`).

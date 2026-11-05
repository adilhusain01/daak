# Swarm: the lid photos

Every handoff's lid photo is uploaded to Swarm **encrypted** (`Swarm-Encrypt: true` on the Bee `/bytes` endpoint, through the public gateway `api.gateway.ethswarm.org`). An encrypted Swarm reference is 128 hex characters: the chunk address plus the decryption key, so whoever holds the reference can open the photo, and nobody else can.

That reference must not be public, so Daak seals it before it goes on chain: AES-256-GCM with a key derived from Daak's server secret (`web/lib/swarm.ts`). The sealed reference is stored in the handoff's Arkiv entity, in the optional `photo` bytes column. The SHA-256 of the photo is stored in the clear (`photoSha256`) and in the HCS message, so anyone can check that a photo shown later is the one taken at the handoff.

Opening a photo: the operator dashboard links each handoff to `/api/photo/<code>/<hop>`, which reads the Arkiv entity, unseals the reference and streams the image from Swarm. The retailer's tracking page never receives the reference.

Why Swarm here: a photo of a parcel at a bus stand is evidence in a dispute, so it has to outlive Daak's own servers and be tamper-evident, but it should not be readable by everyone who can query the public record. Encrypted content addressing gives exactly that.

Caveat for the hackathon build: uploads go through the public gateway's postage, so their lifetime follows that gateway; production would buy its own postage batch.

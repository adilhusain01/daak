# Swarm: lid photos and ID photos

## What is stored where

| Data | Where | Who can open it |
|---|---|---|
| Lid photo of every handoff | Swarm, uploaded encrypted (`Swarm-Encrypt: true`) | whoever holds the 128-hex reference |
| Driver's government ID photo (KYC) | Swarm, uploaded encrypted | the same |
| The Swarm reference of a lid photo | Arkiv `daak.handoff` entity, `photo` bytes column, **sealed** with AES-256-GCM | only Daak's server (the operator dashboard) |
| The Swarm reference of an ID photo | Arkiv `daak.badge` entity, inside the sealed `kyc` bytes column | only Daak's server |
| SHA-256 of the lid photo | Arkiv `daak.handoff.photoSha256` and the Hedera HCS message, in the clear | anyone, to check a photo shown later is the one taken |

An encrypted Swarm reference is the chunk address plus the decryption key, so holding it is enough to open the file. That is why it is never stored as-is in a public entity: Daak seals it first (`sealRef` in `web/lib/swarm.ts`, a key derived from the server secret and the purpose). The public record carries only the sealed reference and the photo's hash.

## Example

- Consignment `KNP-6025`, hop 1 (Kanpur, shop to Ramesh), 5 Nov 2026 18:44 UTC.
- Arkiv entity key: `0x1d158aebf51901df81e3f03b8938ad8bdf175c9952bb79a6387b365d3d5a31f1` (owner `0x610FdB41DA83138615C317c89fd9EB09271a46fe`, Rabdi).
- Its `photo` column holds the sealed reference (208 base64 characters, starting `0PQVTJiMfLt6B+fs+tVNLLiSeSWlsP7f...`). Unsealed on the server it is a 128-hex Swarm reference, which the dashboard's "View lid photo" streams from Swarm.
- Handoff entities expire after one day; the demo run's fresh example goes here on Saturday: _to be filled after the recorded run_.

## Postage

Uploads go through the public Swarm gateway, `https://api.gateway.ethswarm.org`, which stamps them with its own postage batch. The gateway does not expose that batch id (`GET /stamps` returns 404) and did not return it in the upload response headers, so we cannot quote a batch id. Daak did not buy its own batch during the hackathon (that needs xBZZ on Gnosis); production would, and would pin the lid photos for as long as a dispute can be raised.

## Upload and read code

- Upload: `uploadPhoto(photo)` in `web/lib/swarm.ts`, a `POST /bytes` with `Swarm-Encrypt: true`; returns the reference.
- Seal before Arkiv: `sealRef(reference)`; open on the server: `openRef(sealed)`.
- Read: `downloadPhoto(reference)`, a `GET /bytes/<reference>`.
- Lid photos: written in `web/app/api/handoff/route.ts` (after the driver gets the verdict); read in `web/app/api/photo/[code]/[hop]/route.ts` and `web/app/api/recheck/route.ts` (0G rechecks the photo after an outage).
- ID photos: written in `web/app/api/join/route.ts`; read in `web/app/api/kyc/[uid]/route.ts` (operator only).

## Reproduce

```bash
# upload an encrypted file and read it back through the same gateway
REF=$(curl -s -X POST -H "Swarm-Encrypt: true" -H "Content-Type: image/jpeg" \
  --data-binary @lid.jpg https://api.gateway.ethswarm.org/bytes | jq -r .reference)
echo ${#REF}                                   # 128: address plus key
curl -s https://api.gateway.ethswarm.org/bytes/$REF -o back.jpg && cmp lid.jpg back.jpg && echo same
```

In the app: do a handoff, then open `/ops`, find the delivery and press "View lid photo".

## In the demo video

_Timestamp to be filled after recording: the moment the dashboard opens a lid photo from Swarm._

## Why Swarm

A photo of a parcel at a bus stand is evidence in a dispute. It has to outlive Daak's own servers and be tamper-evident (the hash is on Hedera), but it must not be readable by everyone who can query the public record. Encrypted content addressing gives both.

## Friction

- The gateway does not tell you which batch stamped your upload, so the lifetime of an upload is the gateway's business.
- Without our own Bee node, uploads cost a round trip to a shared gateway; Daak does them after replying to the driver so the handoff never waits on Swarm.

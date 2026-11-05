# AI usage

ETHGlobal asks every team to document how AI tools were used, file by file. This file is that record, kept up to date with each commit.

| File or folder | How AI was used | What the team did |
|---|---|---|
| `README.md`, `AI_USAGE.md`, `.gitignore` | Drafted with an AI coding assistant from the team's plan | Team wrote the plan and reviewed the text |
| `android/` build setup and `MainActivity.kt` shell | Scaffolded with an AI coding assistant, modelled on the team's earlier Kotlin app setup | Team chose native Kotlin over a web app after testing NFC on the phone, and reviewed the build |
| `android/.../Nfc.kt`, `MainActivity.kt`, `Ui.kt`, `Voice.kt`, `Api.kt` | Written with an AI coding assistant from the team's flow (badge, parcel tap, receiver badge, lid photo, verdict) | Team designed the handoff flow and the Hindi prompts, tested NFC and the screens on a real phone |
| `web/lib/zg.ts`, `web/lib/hedera.ts`, `web/lib/arkiv.ts`, `web/app/api/handoff/route.ts`, `web/scripts/*` | Written with an AI coding assistant against the sponsors' SDK docs | Team designed the verdict rules (green, held, unchecked), the safe-stop and what goes on chain, and ran the HCS topic setup on testnet |
| `web/lib/arkiv.ts` (Arkiv as the database), `web/lib/payout.ts`, `web/app/api/track/*`, `web/scripts/setup-money.mts` | Written with an AI coding assistant against the Arkiv and Hedera SDK docs | Team designed the money model (dINR with a 2% network-enforced fee, escrow, payout scheduled at booking and signed at delivery, split by km) and ran it on testnet |

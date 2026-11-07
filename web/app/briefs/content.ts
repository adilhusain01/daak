/**
 * The mentor briefs: one per partner track, plus the run-sheet for setting up a live demo. Every id and number is from
 * the README's "Live on testnet" table, docs/submission.md or the code itself; status lines say what is live and what
 * is not. Rendered at /briefs/<id> and exported to docs/briefs/<id>.pdf.
 */
export type Row = { what: string; how: string; where?: string; proof?: { label: string; href?: string } };
export type Ask = { ask: string; how: string; status: "live" | "partial" | "gap" };
export type Brief = {
  id: string; partner: string; logo?: string; logoText?: string; title: string; talk: string[];
  tracks: { name: string; prize: string }[]; asks: Ask[]; uses: Row[]; limits: string[]; questions: string[]; files?: string[];
};

const HS = (kind: string, id: string) => `https://hashscan.io/testnet/${kind}/${id}`;
const ZG = (tx: string) => `https://chainscan.0g.ai/tx/${tx}`;

export const BRIEFS: Brief[] = [
  {
    id: "hedera", partner: "Hedera", logo: "/logos/hedera.svg", logoText: "Hedera",
    title: "Every booking is an x402 payment, and the pay rules run on Hedera with no Solidity",
    talk: [
      "A shop's agent books a delivery by calling Daak's API. It gets a 402 with the exact price, pays in Daak's rupee token through the official facilitator, and retries. Nobody approves it.",
      "The money sits in escrow. Each driver's advance is a token transfer the moment the next person confirms the handover, and the rest is one long-term scheduled transaction that executes itself after delivery unless the shop files a claim.",
      "Every booking, handoff, check and payout is a message on one HCS topic, and the drivers' work records are recomputed from it.",
    ],
    tracks: [{ name: "AI Agents That Pay (x402)", prize: "$3,000" }, { name: "No Solidity", prize: "$1,000" }],
    asks: [
      { ask: "An x402-protected endpoint settling on Hedera through a listed facilitator", how: "POST /api/book answers 402 with the booking's exact price; settled in dINR through facilitator 0.0.9185802", status: "live" },
      { ask: "An agent completes a paid request with no human", how: "Each shop's agent reads /.well-known/x402, books, pays and retries on its own", status: "live" },
      { ask: "Transaction id in the README, HashScan link in the video", how: "KNP-3WAE9's settlement 0.0.9185802-1793986788-181264432 is in the README; the video still has to show it", status: "partial" },
      { ask: "Spending controls", how: "Only dINR, at most Rs 2,000 a booking, only to Daak's account; a booking cap per hour", status: "live" },
      { ask: "Agent identity (HCS-14 or ERC-8004)", how: "Both sides carry an HCS-14 UAID, checked against Hashgraph Online's SDK; the agent checks Daak's before paying", status: "live" },
      { ask: "HCS audit topic", how: "Topic 0.0.11327109: every booking, handoff, check, payout and assistant question", status: "live" },
      { ask: "HTS settlement, custom fees that split revenue", how: "dINR carries a 2% fractional custom fee that pays Daak at the network level", status: "live" },
      { ask: "Scheduled transactions", how: "Holdbacks in one waitForExpiry schedule per delivery; a claim deletes it", status: "live" },
      { ask: "Agent Kit or Network MCP", how: "Ask Daak, the operator's assistant, reads balances, HCS and transactions through the Agent Kit's query plugins", status: "live" },
      { ask: "A2A negotiation", how: "Not built: the price is the published meter, so there is nothing to negotiate", status: "gap" },
      { ask: "No Solidity", how: "Hedera JavaScript SDK only: HTS, HCS, scheduled transactions, mirror node", status: "live" },
    ],
    uses: [
      { what: "x402 booking", how: "The 402 quotes the meter for the distance and the parcel's charged weight, plus a 12% booking fee", where: "web/lib/x402.ts, web/app/api/book", proof: { label: "KNP-3WAE9 settlement, Rs 599.26", href: HS("transaction", "0.0.9185802-1793986788-181264432") } },
      { what: "Catalogue discovery", how: "/.well-known/x402 lists the endpoint, the meter and Daak's UAID; the agent reads it before paying", where: "web/app/.well-known/x402" },
      { what: "Per-shop agent accounts", how: "A Hedera account per shop holding prepaid dINR, topped up when the shop pays by UPI (the UTR goes on the log)", where: "web/lib/agent.ts", proof: { label: "Gupta Garments' agent", href: HS("account", "0.0.11342762") } },
      { what: "dINR, the rupee credit", how: "An HTS token with a 2% fractional custom fee to Daak", where: "web/scripts/setup-money.mts", proof: { label: "Token 0.0.11327356", href: HS("token", "0.0.11327356") } },
      { what: "Escrow and advances", how: "The fee is locked in escrow; each driver gets 50, 70 or 90% of their stretch when the next person confirms", where: "web/lib/split.ts", proof: { label: "Escrow 0.0.11327245", href: HS("account", "0.0.11327245") } },
      { what: "Holdbacks that release themselves", how: "All held pay in one long-term scheduled transfer (waitForExpiry); no server sends it", where: "web/lib/split.ts", proof: { label: "KNP-3WAE9, released itself at 00:34:05", href: HS("schedule", "0.0.11344027") } },
      { what: "Claims", how: "Deleting the schedule; the responsible stop's held pay repays the shop, topped up from a protection pool", where: "web/app/api/resolve", proof: { label: "Pool 0.0.11330722", href: HS("account", "0.0.11330722") } },
      { what: "The public log", how: "One HCS topic; badges appear only as a 12-character hash", where: "web/lib/hedera.ts", proof: { label: "Topic 0.0.11327109", href: HS("topic", "0.0.11327109") } },
      { what: "HCS-14 identity", how: "Daak's UAID published with its fields; each booking records the paying agent's verified UAID", where: "web/lib/uaid.ts", proof: { label: "HCS message 56", href: "https://hashscan.io/testnet/topic/0.0.11327109?sequence=56" } },
      { what: "Agent Kit", how: "Ask Daak answers from Hedera and Daak's records, proposes actions as buttons a person confirms, and every question is audited on HCS", where: "web/app/api/assistant" },
      { what: "Mirror node", how: "Balances, the escrow, schedules and the drivers' records", where: "web/lib/payout.ts, web/lib/history.ts" },
    ],
    limits: [
      "Testnet only. On mainnet the rupee collections and escrow would sit with a licensed payment aggregator; dINR stays a credit, never a currency.",
      "The holdback window is 15 minutes for the demo (HOLDBACK_HOURS); production would hold it for a day or more.",
      "The UPI payout to a driver's bank is recorded by the operator with its UTR; a payout partner would do it automatically.",
    ],
    questions: [
      "Is a custom HTS token like dINR a good fit for x402 on mainnet, or do you expect USDC on Hedera?",
      "How long can a waitForExpiry schedule wait on mainnet, and what does it cost to hold many open at once?",
      "Would you score HCS-14 alone as agent identity, or should Daak also register an ERC-8004 identity?",
      "Is there a pattern you like for A2A negotiation where the price is a fixed public meter?",
    ],
  },
  {
    id: "0g", partner: "0G", logo: "/logos/0g.svg",
    title: "0G makes the decision at every bus stand: is this the right parcel, still sealed, and may the driver be paid",
    talk: [
      "A sealed 0G check is the step every user waits on. Shops and drivers use it for every parcel, and drivers come back because each handover pays them on the spot.",
      "The lid photo goes to a sealed vision model in a TEE, in private mode, so it can never fall back to an unsealed one. Its answer moves money: green releases that driver's pay, held stops it. Without 0G, no handover pays until a person reviews the photo.",
      "Every decision is written to 0G Storage with its request id, and each booking pays its own share of the checks into Daak's own 0G compute account.",
    ],
    tracks: [{ name: "Build with 0G Private Computer", prize: "$2,500" }, { name: "Agents That Pay for Themselves", prize: "$1,000" }],
    asks: [
      { ask: "Inference on 0G in the main user flow, with request ids", how: "Every handover sends the lid photo to 0gm-1.0-35b-a3b on Intel TDX and acts on the verdict; the request id shows on the parcel page and goes to 0G Storage", status: "live" },
      { ask: "A working app judges can try, with a reason to return tomorrow", how: "The Android app at the stand and every delivery at /live; drivers return because each checked handover pays them at once", status: "live" },
      { ask: "What breaks if 0G is removed", how: "No handover pays until a person reviews the photo; a labelled backup can only hold, never release", status: "live" },
      { ask: "iAI bonus: users sign in with a 0G account and spend their own credits", how: "Not built: Daak pays for the checks from its own compute account, funded by bookings", status: "gap" },
      { ask: "Money in, credit landing in the agent's compute account", how: "2% of each booking fee in dINR on Hedera, and the same value in 0G into Daak's Direct account, both ids on HCS", status: "live" },
      { ask: "Inference paid from that account, with tx hashes and request ids", how: "Daak asks the sealed provider from its own account first and verifies the TEE signature; Router credit is the fallback", status: "partial" },
      { ask: "No manual top-up, a spend cap, graceful degradation", how: "Top-ups come from bookings, capped at 1 0G a day; low funds fall back to the Router, then the safe-stop", status: "live" },
    ],
    uses: [
      { what: "Sealed vision check", how: "0G Router, X-0G-Provider-Trust-Mode: private, pinned to the TEE provider 0xf4FB…0B250; reads the code on the lid and the parcel's state", where: "web/lib/zg.ts, web/app/api/handoff", proof: { label: "KNP-7115 matched, chatcmpl-b30615d2…, 9.2 s" } },
      { what: "Refusal when it is wrong", how: "The same photo checked against KNP-9999 was refused: \"the code on the parcel is KNP-7115\"", proof: { label: "chatcmpl-ff00a134…, 7.2 s" } },
      { what: "Decision records on 0G Storage", how: "Every decision at every checkpoint, whatever it was", where: "web/lib/zgstore.ts", proof: { label: "First record, root 0xe803a6bf…", href: ZG("0xa90f5e64ebb33f64510f718c7c298373d6623235e48a52ea1519ed2f35ffb704") } },
      { what: "Daak's own compute account", how: "0G Direct from Daak's wallet 0x575F…8901; each answer's TEE signature verified", where: "web/lib/compute.ts", proof: { label: "Account opened, 3 0G", href: ZG("0xa1135dbf50dae2140d0c1e21aabc7e36fec2e372abc9280bb957dd9987f009d7") } },
      { what: "Bookings pay for the checks", how: "44 paise of dINR on Hedera and 0.032 0G into the compute account for the first booking", where: "computeEarmark in web/lib/rules.ts", proof: { label: "0G top-up tx", href: ZG("0x155619fe0b72df48ac06d0a647a3db260099f451892e937e2ebefbfabe91f6a2") } },
      { what: "Recheck after an outage", how: "\"Recheck with 0G\" pulls the encrypted photo from Swarm and asks again; a green answer releases the pay", where: "web/app/api/recheck", proof: { label: "KNP-3WAE9: a misread stop rechecked green, then paid; KNP-1204: 3 stops after the outage" } },
      { what: "ID reading, sealed", how: "0G reads a driver's ID photo (type, name, last 4, bus licence class, masking, edits) for the operator; only pass or fail goes public", where: "web/app/api/kyc/[uid]/read" },
    ],
    limits: [
      "The only sealed vision provider on mainnet has been unhealthy since about 12:40 on 6 November (still down at 16:23), so live checks fall back to the safe-stop. The first self-paid sealed check receipt waits for it.",
      "The exchange from rupees to 0G is the one step not on chain; in production a payment partner buys the 0G.",
      "Direct needs 3 0G to open an account and 1 0G per provider, which is a lot to lock up for one agent.",
    ],
    questions: [
      "Is a second sealed vision provider coming, or can Daak fail over to a sealed text model with a vision preprocessing step?",
      "For an agent paying for itself, do you prefer Router credit or Direct, and can a server deposit into a Router account?",
      "How should a verifier check the TEE attestation end to end, beyond the provider's signature on each answer?",
      "Is one 0G Storage record per decision the right grain for an episode log, or would you batch a day?",
    ],
  },
  {
    id: "arkiv", partner: "Arkiv", logo: "/logos/arkiv.svg",
    title: "Arkiv is Daak's only database: people, bookings, handoffs and daily orders, each with the lifetime it should have",
    talk: [
      "There is no Postgres and no server disk. Every piece of state lives as a typed Arkiv entity written by one publisher wallet.",
      "Expiry is the design: a handoff record is needed for the day the parcel travels, so it expires after a day; people and bookings after 30.",
      "What users see reads Arkiv directly: the receiving shop's tracking page, the public deliveries list, the drivers page and the app.",
    ],
    tracks: [{ name: "Build on Arkiv, from scratch", prize: "$3,000" }, { name: "Swarm bonus", prize: "$500 (its own brief)" }],
    asks: [
      { ask: "Writes with @arkiv-network/sdk", how: "SDK 1.0.1 on Rabdi (chain 7794095), typed schemas", status: "live" },
      { ask: "At least one feature users see reads from Arkiv", how: "/track/<code>, /live, /drivers and the app all read it", status: "live" },
      { ask: "Wallet addresses and a runnable query in the README", how: "Owner 0x610F…46fe; npx tsx scripts/arkiv-query.mts needs no keys", status: "live" },
      { ask: "/arkiv/schema.md", how: "Five schemas with indexed columns, lifetimes, writers and readers", status: "live" },
      { ask: "One file per criterion: friction, reach, why, how", how: "friction.md, reach.md, why-arkiv.md, how-you-use-arkiv.md", status: "live" },
    ],
    uses: [
      { what: "daak.badge (people)", how: "Name, role, bus and stretches in the clear; phone, UPI and ID details sealed; the phone's signing key and the ID decision patched in place", where: "web/lib/arkiv.ts" },
      { what: "daak.consignment (bookings)", how: "Route, km per leg, each driver's share, fee in paise, weight (a band, or kg:24|60x50x40); written before any money moves", where: "web/app/api/book" },
      { what: "daak.handoff", how: "The 0G verdict, HCS sequence, photo hash, GPS, the sealed Swarm reference and the 0G Storage root; expires after a day", where: "web/app/api/handoff" },
      { what: "daak.standing (daily orders)", how: "Booked by the 04:00 IST run; the day's parcel tag patched in when the shop taps it", where: "web/lib/standing.ts" },
      { what: "daak.pref", how: "A driver's Bachat setting; the payout reads the newest", where: "web/lib/arkiv.ts" },
      { what: "Queries", how: "Newest booking for an NFC serial, every handoff of a code, drivers by stretch, paged lists", where: "web/lib/parcels.ts", proof: { label: "Runnable query", href: "https://github.com/adilhusain01/daak/blob/main/web/scripts/arkiv-query.mts" } },
    ],
    limits: [
      "One publisher wallet writes everything; shops and bus operators reading is open, but writing their own records is the next step.",
      "A dispute window longer than a day would need a handoff's expiry extended when a claim is filed.",
      "Testnet (Rabdi); costs on mainnet are not measured yet.",
    ],
    questions: [
      "Can an entity's expiry be extended in place when a claim is filed, or should Daak write a new one?",
      "What is the expected index lag after a write? Daak retries for up to 10 s.",
      "Would you model the shop and the bus operator as their own writers, and how would owners share one entity type?",
      "Any plan for ordering by an unindexed column to error instead of returning an empty page?",
    ],
    files: ["arkiv/schema.md", "arkiv/friction.md", "arkiv/reach.md", "arkiv/why-arkiv.md", "arkiv/how-you-use-arkiv.md"],
  },
  {
    id: "swarm", partner: "Swarm", logo: "/logos/swarm.svg",
    title: "The lid photo of every handoff and every driver's ID photo live on Swarm, encrypted, opened only by a reference nobody public holds",
    talk: [
      "Every handoff has a photo of the parcel's lid. It goes to Swarm encrypted, so the reference is both the address and the key.",
      "That reference never sits in a public record as it is: Daak seals it before it reaches Arkiv. The public log keeps only the photo's hash, so anyone can check a photo shown later is the one taken.",
      "When 0G was down, the recheck pulled each photo back from Swarm and asked again. That is how KNP-1204's held pay was released.",
    ],
    tracks: [{ name: "Arkiv's Swarm bonus", prize: "$500" }],
    asks: [
      { ask: "Upload encrypted so only the people with the reference can open it", how: "POST /bytes with Swarm-Encrypt: true; a 128-hex reference", status: "live" },
      { ask: "/arkiv/swarm.md", how: "What is stored where, an example entity, postage, upload and read code, reproduction steps", status: "live" },
      { ask: "The Swarm moment in the video, with its timestamp", how: "To film in the demo run and note in swarm.md", status: "partial" },
    ],
    uses: [
      { what: "Lid photos", how: "Uploaded after the driver has the verdict; the hash also goes on HCS", where: "web/lib/swarm.ts, web/app/api/handoff" },
      { what: "Sealed references", how: "AES-256-GCM, a key derived from the server secret and the purpose (sealRef, openRef)", where: "web/lib/swarm.ts" },
      { what: "Operator view", how: "\"View lid photo\" in /ops unseals the reference on the server and streams the photo from Swarm", where: "web/app/api/photo/[code]/[hop]" },
      { what: "0G recheck", how: "The recheck downloads the encrypted photo and sends it to the sealed model", where: "web/app/api/recheck" },
      { what: "ID photos", how: "Uploaded encrypted when a driver joins; the reference sits inside the sealed kyc column", where: "web/app/api/join, web/app/api/kyc/[uid]" },
      { what: "Example", how: "KNP-6025 hop 1: Arkiv entity 0x1d158aeb…31f1, its photo column a sealed reference of 208 base64 characters", proof: { label: "arkiv/swarm.md", href: "https://github.com/adilhusain01/daak/blob/main/arkiv/swarm.md" } },
    ],
    limits: [
      "Uploads go through the public gateway, which stamps them with its own postage batch; Daak has not bought a batch (that needs xBZZ on Gnosis), so I cannot quote a batch id or promise how long photos stay.",
      "Sharing is all or nothing: whoever holds a reference can open the photo, so Daak keeps the keys on its server.",
    ],
    questions: [
      "For dispute evidence kept 30 to 90 days, what batch depth and duration would you buy, and is pinning needed on top?",
      "Would ACT (access control) fit for sharing a photo with the shop and the operator but nobody else, instead of server sealing?",
      "Is there a way to read the batch id behind a gateway upload, for the record?",
    ],
  },
];

/** The run-sheet: one shop, two drivers, one receiver, from nothing to a delivered parcel. */
export const SETUP = {
  cast: [
    ["Shop sending", "Gupta Garments", "Kanpur, Jhakarkati bus stand", "books and pays"],
    ["Driver 1", "Ramesh", "Kanpur to Lucknow, 87 km", "first stretch"],
    ["Driver 2", "Suresh", "Lucknow to Gorakhpur, 272 km", "second stretch"],
    ["Shop receiving", "Ghosh Cloth House", "Gorakhpur bus stand", "takes delivery"],
  ],
  before: [
    "Phones: the latest app on each (two phones at least, for \"both phones signed\"; one phone works with Me, Switch badge). NFC, GPS and data on, app in English (Me, Language), charged.",
    "One blank NFC sticker (NTAG213 or 215) per parcel, a box with a flat lid, and a marker.",
    "Laptop tabs: the landing page (the film), /live, /ops signed in (paste the passcode with no space at the end; 5 wrong tries lock it for 15 minutes), HashScan topic 0.0.11327109, /pitch, these briefs.",
    "0G: check whether the sealed provider is up (the /ops parcel page or the provider list). If it is down, say so: the handoff is recorded and the pay waits, which is the design.",
    "Shop balance: /ops, Shop balances. Keep at least Rs 700 (a 24 kg parcel on 359 km costs Rs 599.26). Top up by UPI and enter the UTR, or use an existing balance.",
    "STAND_RADIUS_M=0 is set in Vercel (the stands are in UP, the demo is in Mumbai). HOLDBACK_HOURS=0.25: held pay releases 15 minutes after delivery.",
  ],
  join: [
    ["Shop", "Continue with Google, Join, \"Shop sending parcels\", shop name, mobile, stand Kanpur."],
    ["Ramesh", "A second Google account: Driver, name, mobile, UPI ID, bus plate, UPSRTC, driving licence with its last 4 and a photo, stretch Kanpur to Lucknow and the bus time."],
    ["Suresh", "Same, stretch Lucknow to Gorakhpur."],
    ["Receiver", "Join as \"Shop receiving parcels\", stand Gorakhpur."],
    ["Operator", "/ops, Driver ID checks: \"Ask 0G to read it\" for each driver, then Verify (by eye if 0G is down). Optional: Ramesh vouches for Suresh by scanning his code from the Me tab."],
  ],
  run: [
    ["Book", "Shop: tap the blank sticker, pick Ghosh Cloth House, the drivers come per stretch. Enter 4 kg and 60 x 50 x 40 cm: it is charged as 24 kg, x2.9. Book and pay. Tap the sticker again to write its tracking link. Write the code on the lid, big.", "HashScan: the x402 settlement and the booking on the topic; /live: the new parcel."],
    ["Accept", "Ramesh and Suresh: Jobs, New jobs, Accept. The card shows the stretch, the pay and the charged weight.", "The answer goes on the log."],
    ["Kanpur", "Ramesh: Hand over, tap the sticker, scan the shop's code (Receiving? Show my code) or tap a badge, photograph the lid with the code readable.", "The verdict in Hindi and English; /live: stop 1."],
    ["Check", "0G reads the lid in its sealed machine. If it is down: \"waiting for the check\"; later, /ops, Recheck with 0G.", "The 0G request id on the stop; the decision on 0G Storage."],
    ["Lucknow", "Ramesh hands to Suresh: tap the sticker, scan Suresh's code (both phones sign), a new lid photo.", "Ramesh's advance on HashScan the moment Suresh confirms."],
    ["Gorakhpur", "Suresh hands to the receiver the same way, with a new photo.", "Suresh's advance; the held pay as one schedule on HashScan, releasing in 15 minutes."],
    ["Track", "Receiver: tap the parcel with any phone.", "The tracking page in Hindi and English, with the road and each stop."],
  ],
  traps: [
    "A new lid photo at every stop: the server refuses a photo it has already seen.",
    "The code must be readable in the photo, or 0G holds the pay (that is a correct refusal, and worth showing once).",
    "One sticker per parcel: the sticker's serial is the parcel.",
    "If a handoff says \"offline\", it is queued on the phone and sent when there is signal; do not redo it.",
    "Bookings are capped at 12 an hour.",
    "If anything stalls, open KNP-3WAE9 on /live: booked, handed over three times, checked by 0G and paid by its own schedule.",
    "After the mentors, before the judges' run: set DATA_SINCE in Vercel to that run's start, so test bookings drop out of the lists.",
  ],
};

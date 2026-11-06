"use client";

import { useEffect, useState } from "react";

/**
 * The real flow, call by call, as the server runs it (app/api/book, app/api/handoff and lib/split). One lane per
 * party, each partner under its own logo; the steps light up in order and a dot travels each call. Pick a flow to
 * replay it, or press a step to stop on it. A phone gets the same steps as a list.
 */
type Lane = "people" | "daak" | "zg" | "hedera" | "swarm" | "arkiv";
const LANES: { id: Lane; name: string; logo?: { src: string; w: number; h: number } }[] = [
  { id: "people", name: "On the route" },
  { id: "daak", name: "Daak" },
  { id: "zg", name: "0G", logo: { src: "/logos/0g.svg", w: 50, h: 24 } },
  { id: "hedera", name: "Hedera", logo: { src: "/logos/hedera.svg", w: 24, h: 24 } },
  { id: "swarm", name: "Swarm", logo: { src: "/logos/swarm.svg", w: 92, h: 24 } },
  { id: "arkiv", name: "Arkiv", logo: { src: "/logos/arkiv.svg", w: 96, h: 22 } },
];
type Step = { from: Lane; to: Lane; text: string; tech: string };

const FLOWS: { id: string; label: string; who: string; steps: Step[] }[] = [
  {
    id: "book", label: "Book", who: "Shop's agent", steps: [
      { from: "people", to: "daak", text: "Asks to book KNP-1204", tech: "POST /api/book" },
      { from: "daak", to: "people", text: "Answers 402 with the exact price", tech: "x402" },
      { from: "people", to: "daak", text: "Retries with a signed dINR payment", tech: "x402 on Hedera" },
      { from: "daak", to: "hedera", text: "Settles it into escrow", tech: "HTS" },
      { from: "daak", to: "arkiv", text: "Writes the booking and its route", tech: "Arkiv entity" },
      { from: "daak", to: "hedera", text: "Puts the booking on the public log", tech: "HCS" },
    ],
  },
  {
    id: "handover", label: "Hand over", who: "Driver's phone", steps: [
      { from: "people", to: "daak", text: "Sticker, badge, lid photo, GPS, signed", tech: "Android Keystore" },
      { from: "daak", to: "arkiv", text: "Looks up both badges", tech: "Arkiv query" },
      { from: "daak", to: "zg", text: "Checks the lid photo, sealed", tech: "0G compute, TEE" },
      { from: "zg", to: "daak", text: "Right code, parcel intact", tech: "verdict" },
      { from: "daak", to: "hedera", text: "Logs the handoff publicly", tech: "HCS" },
      { from: "daak", to: "people", text: "Answers in Hindi, on screen and aloud", tech: "under 20 s" },
      { from: "daak", to: "zg", text: "Keeps the decision", tech: "0G storage" },
      { from: "daak", to: "swarm", text: "Stores the lid photo, encrypted", tech: "Swarm" },
      { from: "daak", to: "arkiv", text: "Writes the handoff with every reference", tech: "Arkiv entity" },
      { from: "daak", to: "hedera", text: "Pays the driver's half", tech: "HTS transfer" },
    ],
  },
  {
    id: "deliver", label: "Deliver", who: "Receiving shop", steps: [
      { from: "people", to: "daak", text: "Last handoff at Gorakhpur", tech: "signed" },
      { from: "daak", to: "zg", text: "Sealed check passes", tech: "0G compute" },
      { from: "daak", to: "hedera", text: "Schedules the held ₹92.26", tech: "scheduled transaction" },
      { from: "hedera", to: "hedera", text: "Runs it at 11:44 by itself", tech: "wait for expiry" },
      { from: "people", to: "daak", text: "Taps the sticker to track", tech: "NFC" },
      { from: "daak", to: "arkiv", text: "Reads the parcel's record", tech: "Arkiv query" },
    ],
  },
];

const W = 1200, HEAD = 96, ROW = 52, LEFT = 70;
const laneX = (id: Lane) => LEFT + (LANES.findIndex((l) => l.id === id) + 0.5) * ((W - LEFT) / LANES.length);
const STEP_MS = 1100;

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); setR(m.matches); const f = () => setR(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return r;
}

function Logo({ lane, className = "" }: { lane: (typeof LANES)[number]; className?: string }) {
  if (lane.id === "hedera" && lane.logo) return <span className={`inline-flex items-center gap-1 font-bold text-ink ${className}`}><img src={lane.logo.src} alt="" width={16} height={16} className="size-4" />Hedera</span>;
  return lane.logo
    ? <img src={lane.logo.src} alt={lane.name} width={lane.logo.w} height={lane.logo.h} className={`h-5 w-auto ${className}`} />
    : <span className={`font-display text-base font-semibold ${className}`}>{lane.name}</span>;
}

export function Architecture() {
  const reduced = useReduced();
  const [flow, setFlow] = useState(1);
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const f = FLOWS[flow];

  useEffect(() => {
    if (reduced) { setAt(f.steps.length - 1); return; }
    if (held) return;
    // Walk the steps, rest two beats on the last one, then start again.
    const t = setInterval(() => setAt((a) => (a + 1) % (f.steps.length + 2)), STEP_MS);
    return () => clearInterval(t);
  }, [flow, held, reduced, f.steps.length]);

  const pick = (i: number) => { setFlow(i); setAt(0); setHeld(false); };
  const cur = Math.min(at, f.steps.length - 1);
  const H = HEAD + f.steps.length * ROW + 24;
  const lanes = LANES.map((l) => (l.id === "people" ? { ...l, name: f.who } : l));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Which flow">
        {FLOWS.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={flow === i} onClick={() => pick(i)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${flow === i ? "bg-ink text-paper" : "bg-card-paper text-soft-ink shadow-[inset_0_0_0_1px_var(--color-rule),var(--shadow-key)] hover:text-ink"}`}>
            {x.label}
          </button>
        ))}
        <span className="ml-1 text-sm text-muted-ink">{f.steps.length} calls, in the order the server makes them</span>
      </div>

      {/* Wide: a sequence diagram with a lane per party. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden h-auto w-full md:block" role="img" aria-labelledby="flow-t">
        <title id="flow-t">{`${f.label}: ${f.steps.map((s, i) => `${i + 1}. ${s.text}`).join(" ")}`}</title>
        {lanes.map((l) => {
          const x = laneX(l.id);
          const boxW = 150;
          return (
            <g key={l.id}>
              <line x1={x} x2={x} y1={HEAD - 6} y2={H - 10} className="stroke-rule" strokeWidth={1.5} strokeDasharray="3 5" />
              <rect x={x - boxW / 2} y={8} width={boxW} height={HEAD - 26} rx={10} className={l.id === "daak" ? "fill-gold/25 stroke-gold" : "fill-card-paper stroke-rule"} strokeWidth={1.5} />
              {l.id === "hedera" && l.logo ? (
                <g>
                  <image href={l.logo.src} x={x - 48} y={8 + (HEAD - 26) / 2 - 12} width={24} height={24} />
                  <text x={x - 16} y={8 + (HEAD - 26) / 2 + 7} className="fill-ink font-sans font-bold" fontSize={19}>Hedera</text>
                </g>
              ) : l.logo
                ? <image href={l.logo.src} x={x - l.logo.w / 2} y={8 + (HEAD - 26) / 2 - l.logo.h / 2} width={l.logo.w} height={l.logo.h} preserveAspectRatio="xMidYMid meet" />
                : <text x={x} y={8 + (HEAD - 26) / 2 + 8} textAnchor="middle" className="fill-ink font-display font-semibold" fontSize={l.id === "daak" ? 26 : 19}>{l.name}</text>}
            </g>
          );
        })}
        {f.steps.map((s, i) => {
          const y = HEAD + 26 + i * ROW;
          const a = laneX(s.from), b = laneX(s.to);
          const state = i < cur ? "past" : i === cur ? "now" : "next";
          const line = state === "now" ? "stroke-gold" : state === "past" ? "stroke-ink/70" : "stroke-rule";
          const self = s.from === s.to;
          const d = self ? `M${a} ${y - 6} h46 v16 h-40` : `M${a} ${y} H${b}`;
          const dir = self ? -1 : Math.sign(b - a);
          const tipX = self ? a + 6 : b, tipY = self ? y + 10 : y;
          const lx = self ? a + 58 : Math.min(a, b) + 14;
          return (
            <g key={`${f.id}-${i}`} className="cursor-pointer" onClick={() => { setHeld(true); setAt(i); }}>
              <rect x={LEFT} y={y - ROW / 2} width={W - LEFT} height={ROW} className="fill-transparent" />
              <text x={30} y={y + 5} textAnchor="middle" className={`font-mono ${state === "next" ? "fill-muted-ink/60" : "fill-ink"}`} fontSize={13}>{i + 1}</text>
              <path d={d} fill="none" className={`${line} transition-colors duration-300`} strokeWidth={state === "now" ? 2.5 : 1.5} />
              <path d={`M${tipX} ${tipY} l${-8 * dir} -5 v10 z`} className={`${state === "now" ? "fill-gold" : state === "past" ? "fill-ink/70" : "fill-rule"} transition-colors duration-300`} />
              <circle cx={a} cy={self ? y - 6 : y} r={4} className={state === "next" ? "fill-rule" : "fill-ink"} />
              <text x={lx} y={y - 9} className={`font-sans font-semibold transition-colors duration-300 ${state === "next" ? "fill-muted-ink/70" : "fill-ink"}`} fontSize={14} paintOrder="stroke" stroke="var(--color-paper)" strokeWidth={5} strokeLinejoin="round">
                {s.text} <tspan className="font-mono font-normal fill-muted-ink" fontSize={12}>{s.tech}</tspan>
              </text>
              {state === "now" && !reduced && (
                <circle r={5} className="fill-gold">
                  <animateMotion key={`${flow}-${i}-${at}`} dur={`${STEP_MS * 0.8}ms`} fill="freeze" path={d} />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Phone: the same steps, one per row, each naming where it goes. */}
      <ol className="flex flex-col md:hidden">
        {f.steps.map((s, i) => {
          const from = lanes.find((l) => l.id === s.from)!, to = lanes.find((l) => l.id === s.to)!;
          const state = i < cur ? "past" : i === cur ? "now" : "next";
          return (
            <li key={`${f.id}-${i}`} onClick={() => { setHeld(true); setAt(i); }}
              className={`grid grid-cols-[1.5rem_1fr] gap-x-3 border-t border-rule py-3 transition-opacity duration-300 ${state === "next" ? "opacity-45" : ""}`}>
              <span className={`font-mono text-sm ${state === "now" ? "text-gold-deep" : ""}`}>{i + 1}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-ink">
                  <Logo lane={from} className="h-4 text-sm" /><span aria-hidden className={state === "now" ? "text-gold-deep" : ""}>→</span><Logo lane={to} className="h-4 text-sm" />
                </p>
                <p className="mt-1 font-semibold">{s.text}</p>
                <p className="font-mono text-xs text-muted-ink">{s.tech}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

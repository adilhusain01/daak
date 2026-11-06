"use client";

import { useEffect, useRef, useState } from "react";
import { ROUTE } from "@/components/landing/route";

/**
 * KNP-1204's real day, replayed on the real road: what happened at each point and which part of the stack did it.
 * Every number is from the public log for that parcel.
 */
const BEATS = [
  { at: 0, place: "Kanpur, 7:04 am", title: "Booked and paid", body: "Gupta Garments' agent paid ₹206.64 for 359 km: the meter plus Daak's 12% booking fee. No one approved it.", stack: "Hedera x402, paid in dINR" },
  { at: 0, place: "Kanpur stand", title: "Handed to Ramesh", body: "Tap the parcel, tap Ramesh's badge, photograph the lid. The phone signs it; the photo is stored encrypted.", stack: "Phone key, Swarm, Arkiv" },
  { at: 0, place: "Kanpur stand", title: "Checked in a sealed AI", body: "0G read the code on the lid inside a TEE: right parcel, right stop, still sealed.", stack: "0G compute, private mode" },
  { at: ROUTE.lucknowAt, place: "Lucknow, 87 km", title: "Ramesh paid at the handover", body: "Half his ₹44.71 the moment Suresh confirmed: ₹22.35 now, the rest held until delivery.", stack: "Hedera token transfer" },
  { at: 1, place: "Gorakhpur, 272 km more", title: "Delivered. Held pay released itself", body: "At 11:44 a scheduled transfer paid the drivers the ₹92.26 still held. No server sent it.", stack: "Hedera scheduled transaction" },
];
const BEAT_MS = 3600;

export function JourneyHero() {
  const path = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  /** Points along the road, measured once, so rendering never reads the path element. */
  const [samples, setSamples] = useState<{ x: number; y: number }[]>([]);
  const [beat, setBeat] = useState(0);
  const [pos, setPos] = useState(0); // 0..1 along the road
  const [playing, setPlaying] = useState(true);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const el = path.current;
    if (el) {
      const L = el.getTotalLength();
      setLen(L);
      setSamples(Array.from({ length: 501 }, (_, i) => { const p = el.getPointAtLength((i / 500) * L); return { x: p.x, y: p.y }; }));
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setStill(true); setPlaying(false); setBeat(BEATS.length - 1); setPos(1); }
  }, []);

  // One clock drives the parcel: it travels to each beat's place during the first part of the beat, then rests there.
  useEffect(() => {
    if (!playing || still) return;
    let raf = 0;
    const start = performance.now() - beat * BEAT_MS;
    const tick = (now: number) => {
      const total = BEATS.length * BEAT_MS + 2400; // a rest on the last frame before it starts again
      // The first frame's timestamp can come before `start`; keep t inside the loop either way.
      const t = (((now - start) % total) + total) % total;
      const i = Math.max(0, Math.min(BEATS.length - 1, Math.floor(t / BEAT_MS)));
      const within = Math.min(1, (t - i * BEAT_MS) / (BEAT_MS * 0.55));
      const from = BEATS[Math.max(0, i - 1)].at, to = BEATS[i].at;
      const ease = 1 - Math.pow(1 - within, 3);
      setBeat(i);
      setPos(from + (to - from) * ease);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, still]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (i: number) => { setPlaying(false); setBeat(i); setPos(BEATS[i].at); };
  const point = samples.length ? samples[Math.round(pos * 500)] : { x: ROUTE.stops.KNP[0], y: ROUTE.stops.KNP[1] };
  const b = BEATS[beat];
  const reached = (at: number) => pos >= at - 0.001;

  return (
    <div className="flex flex-col gap-5">
      <figure className="relative" aria-label="The road from Kanpur to Gorakhpur via Lucknow, with parcel KNP-1204 on it">
        <svg viewBox={`0 -30 ${ROUTE.width} ${ROUTE.height + 90}`} className="w-full overflow-visible" role="img">
          <title>Kanpur to Lucknow to Gorakhpur by road, 359 km</title>
          <path d={ROUTE.d} fill="none" className="stroke-paper/15 max-sm:[stroke-width:18]" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
          <path ref={path} d={ROUTE.d} fill="none" className="stroke-lamp max-sm:[stroke-width:9]" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={len || 1} strokeDashoffset={len ? len * (1 - pos) : 1} />
          {([["KNP", "Kanpur", 0, "start"], ["LKO", "Lucknow", ROUTE.lucknowAt, "middle"], ["GKP", "Gorakhpur", 1, "end"]] as const).map(([id, name, at, anchor]) => {
            const [x, y] = ROUTE.stops[id];
            const on = reached(at);
            return (
              <g key={id}>
                <rect x={x - 9} y={y - 9} width={18} height={18} rx={5} style={{ transformBox: "fill-box", transformOrigin: "center" }} className={`max-sm:scale-[1.8] ${on ? "fill-lamp" : "fill-night stroke-paper/40"}`} strokeWidth={2} />
                <text x={x} y={id === "KNP" ? y + 52 : y - 26} textAnchor={anchor} className={`font-display text-[26px] font-bold max-sm:text-[54px] ${on ? "fill-paper" : "fill-paper/45"}`}>{name}</text>
              </g>
            );
          })}
          {/* The parcel: a small box with its tape line. */}
          <g transform={`translate(${point.x} ${point.y})`}>
            {/* Drawn twice as large on a phone, where the whole road is 360 px wide. */}
            <g className="max-sm:scale-[1.9]" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <rect x={-15} y={-15} width={30} height={30} rx={6} className="fill-paper" />
              <path d="M-15 -3 H15" className="stroke-wait" strokeWidth={4} />
            </g>
          </g>
        </svg>
      </figure>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div aria-live="polite" className="min-h-36 rounded-xl border border-paper/15 bg-paper/5 p-5">
          <p className="text-sm text-paper/60">{b.place}</p>
          <p className="mt-1 font-display text-2xl font-bold leading-tight text-paper sm:text-3xl">{b.title}</p>
          <p className="mt-1 max-w-2xl text-paper/80">{b.body}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-lamp/15 px-2.5 py-1 text-sm font-medium text-lamp">
            <span className="size-1.5 rounded-full bg-lamp" />{b.stack}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Steps of the journey">
          {BEATS.map((x, i) => (
            <button key={x.title} onClick={() => choose(i)} aria-pressed={beat === i}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-[transform,background-color] duration-150 active:scale-[0.97] ${beat === i ? "bg-lamp text-night" : "bg-paper/10 text-paper hover:bg-paper/15"}`}>
              {i + 1}. {["Book", "Hand over", "Check", "Pay", "Deliver"][i]}
            </button>
          ))}
          {!still && (
            <button onClick={() => setPlaying((p) => !p)} className="rounded-lg border border-paper/25 px-3 py-2 text-sm font-medium text-paper transition-transform active:scale-[0.97]">
              {playing ? "Pause" : "Play"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

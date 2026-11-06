/**
 * A parcel's stops as one picture: a line with a node per stand. A proven stretch is gold, a held one oxblood,
 * one waiting for a check is dashed gold, and the rest of the road is a hairline. Across on a wide screen, down on a phone.
 */
export type StopState = "green" | "held" | "unchecked" | "next" | "later";
export type Stop = { hop: number; place: string; km?: number | null; state: StopState; note?: string };

const NODE: Record<StopState, string> = {
  green: "bg-gold", held: "bg-held", unchecked: "bg-paper shadow-[inset_0_0_0_3px_var(--color-gold)]",
  next: "bg-paper shadow-[inset_0_0_0_2px_var(--color-ink)]", later: "bg-paper shadow-[inset_0_0_0_1.5px_var(--color-rule)]",
};
const SEG: Record<StopState, string> = {
  green: "bg-gold", held: "bg-held", unchecked: "bg-[repeating-linear-gradient(90deg,var(--color-gold)_0_6px,transparent_6px_10px)]",
  next: "bg-rule", later: "bg-rule",
};
const SEG_V: Record<StopState, string> = { ...SEG, unchecked: "bg-[repeating-linear-gradient(180deg,var(--color-gold)_0_6px,transparent_6px_10px)]" };
const WORD: Record<StopState, string> = { green: "Proven", held: "Held for a check", unchecked: "Waiting for a check", next: "Next", later: "Later" };
const TONE: Record<StopState, string> = { green: "text-gold-deep", held: "text-held", unchecked: "text-gold-deep", next: "text-ink", later: "text-muted-ink" };

export function RouteSteps({ stops }: { stops: Stop[] }) {
  return (
    <>
      <ol className="hidden grid-flow-col auto-cols-fr md:grid" aria-label="Stops">
        {stops.map((s, i) => (
          <li key={s.hop} className="relative flex flex-col gap-3 pr-4">
            <div className="flex items-center">
              <span className={`relative z-10 size-4 shrink-0 rounded-[4px] ${NODE[s.state]}`} />
              {i < stops.length - 1 && <span className={`h-1 flex-1 ${SEG[stops[i + 1].state === "later" || stops[i + 1].state === "next" ? "later" : stops[i + 1].state]}`} />}
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold leading-tight">{s.place.split(",")[0]}</p>
              <p className="truncate text-sm text-muted-ink">{s.place.split(",").slice(1).join(",").trim() || "Bus stand"}{s.km ? `, ${s.km} km` : ", pickup"}</p>
              <p className={`mt-1 text-sm font-semibold ${TONE[s.state]}`}>{WORD[s.state]}</p>
              {s.note && <p className="text-sm text-soft-ink">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      <ol className="flex flex-col md:hidden" aria-label="Stops">
        {stops.map((s, i) => (
          <li key={s.hop} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1 size-4 shrink-0 rounded-[4px] ${NODE[s.state]}`} />
              {i < stops.length - 1 && <span className={`w-1 flex-1 ${SEG_V[stops[i + 1].state === "later" || stops[i + 1].state === "next" ? "later" : stops[i + 1].state]}`} />}
            </div>
            <div className="min-w-0 pb-6">
              <p className="font-display text-xl font-semibold leading-tight">{s.place.split(",")[0]}</p>
              <p className="text-sm text-muted-ink">{s.km ? `${s.km} km` : "Pickup"}</p>
              <p className={`mt-1 text-sm font-semibold ${TONE[s.state]}`}>{WORD[s.state]}</p>
              {s.note && <p className="text-sm text-soft-ink">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/** One stretch's pay as a bar: the part paid at the handover in gold, the part held until delivery hatched. */
export function PayBar({ now, held, label }: { now: number; held: number; label?: string }) {
  const total = now + held || 1;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-[3px] bg-tray" role="img" aria-label={`₹${now.toFixed(2)} paid at the handover, ₹${held.toFixed(2)} held until delivery`}>
        <div className="h-full bg-gold" style={{ width: `${(now / total) * 100}%` }} />
        <div className="h-full bg-[repeating-linear-gradient(135deg,var(--color-gold)_0_3px,transparent_3px_7px)] opacity-70" style={{ width: `${(held / total) * 100}%` }} />
      </div>
      <p className="font-mono text-xs text-soft-ink">{label ? `${label} · ` : ""}₹{now.toFixed(2)} now, ₹{held.toFixed(2)} held</p>
    </div>
  );
}

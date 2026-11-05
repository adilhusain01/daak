"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { arkivEntity, when, type HandoffView, type LegView } from "@/lib/ui";
import { ProofButton } from "@/components/site-nav";

type Track = { code: string; label: string; feeRupees: number; route: LegView[]; handoffs: HandoffView[] };

const ago = (ms: number) => {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : when(ms);
};

/**
 * What a shopkeeper sees after tapping the parcel with any phone: where it is, what happens next, in Hindi
 * and English, with no chain jargon. Proof sits folded at the bottom for anyone who wants it.
 */
export default function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { data, isLoading, isError } = useQuery<Track>({
    queryKey: ["track", code],
    queryFn: async () => {
      const r = await fetch(`/api/track/${code}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
  });

  if (isLoading) return <main className="w-full px-4 py-10 sm:px-6 lg:px-10 text-muted-ink">Loading parcel {code}...</main>;
  if (isError || !data) {
    return (
      <main className="w-full px-4 py-10 sm:px-6 lg:px-10">
        <p className="text-xl font-semibold">पार्सल {code} नहीं मिला</p>
        <p className="mt-1 text-muted-ink">We could not find parcel {code}. Check the code written on the lid.</p>
      </main>
    );
  }

  const latest = new Map([...data.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h]));
  const reached = data.route.filter((l) => latest.has(l.hop));
  const last = reached.at(-1);
  const lastH = last ? latest.get(last.hop) : undefined;
  const next = data.route.find((l) => !latest.has(l.hop));
  const held = [...latest.values()].some((h) => h.verdict === "held");
  const delivered = !next && !held;

  const hero = held
    ? { tone: "bg-held", hi: "जाँच के लिए रुका है", en: "Stopped for a check", sub: "The parcel is safe. Daak is checking one handoff before the drivers are paid." }
    : delivered
      ? { tone: "bg-ok", hi: "पहुँच गया", en: "Delivered", sub: lastH ? `Handed over at ${last!.place}, ${ago(lastH.at)}.` : "" }
      : last
        ? { tone: "bg-ink", hi: `रास्ते में: ${next!.place.split(",")[0]} की ओर`, en: `On the way to ${next!.place}`, sub: `Last handed over at ${last.place}, ${ago(lastH!.at)}.` }
        : { tone: "bg-ink", hi: "बुक हो गया, पिकअप का इंतज़ार", en: "Booked, waiting for pickup", sub: next ? `First stop: ${next.place}.` : "" };

  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <p className="text-sm text-muted-ink">Daak · पार्सल {data.code}</p>
      <section className={`mt-3 rounded-2xl p-6 text-paper ${hero.tone}`}>
        <p className="text-2xl font-semibold">{hero.hi}</p>
        <p className="text-lg opacity-90">{hero.en}</p>
        {hero.sub && <p className="mt-2 text-sm opacity-85">{hero.sub}</p>}
      </section>
      <p className="mt-3 text-muted-ink">{data.label}</p>

      <ol className="mt-8 flex flex-col">
        {data.route.map((l, i) => {
          const h = latest.get(l.hop);
          const isNext = !h && l.hop === next?.hop;
          return (
            <li key={l.hop} className="relative flex gap-4 pb-6">
              <div className="flex flex-col items-center">
                <span className={`mt-1 size-3.5 rounded-[4px] ${h ? (h.verdict === "held" ? "bg-held" : "bg-ok") : isNext ? "bg-ink" : "bg-rule"}`} />
                {i < data.route.length - 1 && <span className="mt-1 w-px flex-1 bg-rule" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium">{l.place}</p>
                {h ? (
                  <p className={`text-sm ${h.verdict === "held" ? "text-held" : "text-ok"}`}>
                    {h.verdict === "held" ? "जाँच के लिए रुका · Stopped for a check" : "पहुँचा · Reached"} · {when(h.at)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-ink">{isNext ? "अगला पड़ाव · Next stop" : "बाद में · Later"}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {data.handoffs.length > 0 && (
        <details className="mt-4 rounded-xl border border-rule bg-card-paper p-4 text-sm">
          <summary className="cursor-pointer font-medium">हर हैंडऑफ़ का सबूत · Proof of every handoff</summary>
          <p className="mt-2 text-muted-ink">Each handoff is recorded publicly and cannot be changed afterwards.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...latest.values()].map((h) => (
              <ProofButton key={h.key} href={arkivEntity(h.key)}>Open record for stop {h.hop}</ProofButton>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}

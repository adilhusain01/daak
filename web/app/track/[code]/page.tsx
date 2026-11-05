"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { arkivEntity, when, type HandoffView, type LegView } from "@/lib/ui";

type Track = { code: string; label: string; feeRupees: number; route: LegView[]; handoffs: HandoffView[] };

/** The page a retailer opens by tapping the parcel. Plain words, no chain jargon; proof sits at the bottom. */
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

  if (isLoading) return <main className="mx-auto max-w-xl px-4 py-10 text-muted-ink">Loading...</main>;
  if (isError || !data) return <main className="mx-auto max-w-xl px-4 py-10">We could not find parcel {code}.</main>;

  const byHop = new Map(data.handoffs.map((h) => [h.hop, h]));
  const reached = data.route.filter((l) => byHop.has(l.hop));
  const last = reached.at(-1);
  const delivered = reached.length === data.route.length;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <p className="text-sm text-muted-ink">Parcel {data.code}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {delivered ? "Delivered" : last ? `At ${last.place}` : "Booked, waiting for pickup"}
      </h1>
      <p className="mt-1 text-muted-ink">{data.label}</p>

      <ol className="mt-8 flex flex-col">
        {data.route.map((l, i) => {
          const h = byHop.get(l.hop);
          return (
            <li key={l.hop} className="relative flex gap-4 pb-6">
              <div className="flex flex-col items-center">
                <span className={`mt-1 size-3 rounded-sm ${h ? (h.verdict === "held" ? "bg-held" : "bg-ok") : "bg-rule"}`} />
                {i < data.route.length - 1 && <span className="mt-1 w-px flex-1 bg-rule" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium">{l.place}</p>
                {h ? (
                  <p className={`text-sm ${h.verdict === "held" ? "text-held" : "text-ok"}`}>
                    {h.verdict === "held" ? "Stopped for a check · Jaanch ke liye roka gaya" : "Reached · Pahunch gaya"} · {when(h.at)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-ink">Not reached yet</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {data.handoffs.length > 0 && (
        <details className="mt-6 text-sm text-muted-ink">
          <summary className="cursor-pointer">Proof of every handoff</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {data.handoffs.map((h) => (
              <li key={h.key}>
                Stop {h.hop}: <a className="underline underline-offset-2" href={arkivEntity(h.key)} target="_blank">record</a>
                {h.hcs && <> · public log entry {h.hcs}</>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}

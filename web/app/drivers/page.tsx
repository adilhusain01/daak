"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteNav, Page, PageHead } from "@/components/site-nav";
import { Loader } from "@/components/loader";

type Driver = {
  id: string; name: string; vehicle: string; proven: number; held: number; km: number;
  cleanRate: number; advanceReady: boolean;
  idChecked: boolean; tier: { name: string; advancePct: number };
};

/** The three shares a driver can earn at the handover, and what moves them up. */
const LADDER = [
  { pct: 50, when: "New driver" },
  { pct: 70, when: "After 10 clean deliveries" },
  { pct: 90, when: "After 50, at 98% clean" },
];

/** A driver's place on the ladder: three steps, the reached ones filled in gold. */
function Ladder({ pct }: { pct: number }) {
  return (
    <div className="flex items-end gap-1" role="img" aria-label={`${pct}% of each stretch paid at the handover`}>
      {LADDER.map((s, i) => (
        <span key={s.pct} className={`w-5 rounded-[3px] ${pct >= s.pct ? "bg-gold" : "bg-tray"}`} style={{ height: 10 + i * 9 }} />
      ))}
    </div>
  );
}

/** Shops pick drivers by their proven record, computed from the public Hedera log. */
export default function Drivers() {
  const { data, isLoading } = useQuery<{ drivers: Driver[] }>({ queryKey: ["drivers"], queryFn: () => fetch("/api/drivers").then((r) => r.json()) });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Page>
      <SiteNav />
      <PageHead title="Drivers" line="Ranked by proven handoffs. Every number comes from the public log, so anyone can check it." />

      <section aria-label="How the share at handover grows" className="mb-14 grid grid-cols-1 gap-6 border-y border-rule py-8 sm:grid-cols-3">
        {LADDER.map((s, i) => (
          <div key={s.pct} className="flex items-end gap-4">
            <div className="flex items-end gap-1" aria-hidden>
              {LADDER.map((_, j) => <span key={j} className={`w-4 rounded-[3px] ${j <= i ? "bg-gold" : "bg-tray"}`} style={{ height: 8 + j * 8 }} />)}
            </div>
            <div>
              <p className="font-display text-4xl font-medium leading-none">{s.pct}%</p>
              <p className="mt-1 text-sm text-soft-ink">{s.when}</p>
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-ink sm:col-span-3">Paid when the next person confirms the handover. The rest follows on delivery. A clean record also unlocks a fuel advance of 25% of the last 30 days, up to ₹5,000.</p>
      </section>

      {isLoading && <Loader label="Reading the log" className="min-h-[40svh]" />}
      <ol className="flex flex-col">
        {data?.drivers.map((d, i) => (
          <li key={d.id} className="border-b border-rule">
            <button onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}
              className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-5 text-left transition-colors hover:bg-card-paper/50 sm:grid-cols-[3rem_minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))_auto]">
              <span className="font-display text-3xl font-medium text-muted-ink">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-display text-2xl font-semibold">{d.name}</span>
                <span className="block text-sm text-soft-ink">{d.vehicle || "Bus driver"}{d.idChecked ? <span className="text-ok"> · ID checked</span> : <span className="text-muted-ink"> · ID not checked</span>}</span>
              </span>
              <span className="hidden sm:block"><span className="block font-mono text-xl">{d.proven}</span><span className="text-xs text-muted-ink">proven</span></span>
              <span className="hidden sm:block"><span className="block font-mono text-xl">{d.km}</span><span className="text-xs text-muted-ink">km</span></span>
              <span className="hidden sm:block"><span className={`block font-mono text-xl ${d.held ? "text-held" : ""}`}>{Math.round(d.cleanRate * 100)}%</span><span className="text-xs text-muted-ink">clean</span></span>
              <span className="flex items-center gap-3"><Ladder pct={d.tier.advancePct} /><span className="font-mono text-sm">{d.tier.advancePct}%</span></span>
              <span className="col-span-3 flex gap-6 font-mono text-sm text-soft-ink sm:hidden">{d.proven} proven · {d.km} km · {Math.round(d.cleanRate * 100)}% clean</span>
            </button>
            {open === d.id && (
              <div className="grid grid-cols-1 gap-2 pb-5 pl-14 text-sm text-soft-ink sm:grid-cols-2">
                <span>{d.tier.name}: {d.tier.advancePct}% of each stretch at the handover</span>
                <span className={d.advanceReady ? "text-ok" : ""}>Fuel advance {d.advanceReady ? "unlocked" : "not yet unlocked"}</span>
                <span>Held handoffs: {d.held}</span>
                <span className="font-mono text-xs text-muted-ink">On the public log as {d.id}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </Page>
  );
}

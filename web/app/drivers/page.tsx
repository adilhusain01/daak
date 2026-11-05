"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

type Driver = {
  id: string; name: string; vehicle: string; proven: number; held: number; km: number; earnedRupees: number;
  bachatRupees: number; cleanRate: number; advance: { eligibleRupees: number; reason: string };
  idChecked: boolean; tier: { name: string; advancePct: number };
};

/** Shops find drivers by their proven record, not by luck. The record is read from the public Hedera log. */
export default function Drivers() {
  const { data, isLoading } = useQuery<{ drivers: Driver[] }>({ queryKey: ["drivers"], queryFn: () => fetch("/api/drivers").then((r) => r.json()) });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <SiteNav />
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Drivers</h1>
        <p className="text-muted-ink">Ranked by proven deliveries. Every number is computed from the public handoff log, so anyone can check it.</p>
      </header>
      {isLoading && <p className="text-muted-ink">Reading the log...</p>}
      <ol className="flex flex-col gap-3">
        {data?.drivers.map((d, i) => (
          <li key={d.id} className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold">{i + 1}. {d.name}</p>
                <p className="text-sm text-muted-ink">
                  {d.vehicle || "Bus driver"} · {d.idChecked ? <span className="text-ok">ID checked</span> : "ID not checked yet"} · {d.tier.name}, {d.tier.advancePct}% at handover
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span><b className="text-base">{d.proven}</b> proven</span>
                <span><b className="text-base">{d.km}</b> km</span>
                <span className={d.held ? "text-held" : "text-ok"}><b className="text-base">{Math.round(d.cleanRate * 100)}%</b> clean</span>
                <span><b className="text-base">₹{d.earnedRupees.toFixed(2)}</b> earned</span>
              </div>
              <Button className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" onClick={() => setOpen(open === d.id ? null : d.id)}>
                {open === d.id ? "Hide record" : "See record"}
              </Button>
            </div>
            {open === d.id && (
              <div className="mt-3 flex flex-col gap-1 border-t border-rule pt-3 text-sm">
                <span>Bachat saved: ₹{d.bachatRupees.toFixed(2)}</span>
                <span className={d.advance.eligibleRupees ? "text-ok" : "text-muted-ink"}>
                  Fuel advance: {d.advance.eligibleRupees ? `₹${d.advance.eligibleRupees} available` : d.advance.reason}
                </span>
                <span className="text-muted-ink">Held handoffs: {d.held}. Driver id on the public log: {d.id}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}

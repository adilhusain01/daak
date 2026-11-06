"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

type Driver = {
  id: string; name: string; vehicle: string; proven: number; held: number; km: number;
  cleanRate: number; advanceReady: boolean;
  idChecked: boolean; tier: { name: string; advancePct: number };
};

/** What each number on a driver's card means, in the words a shop would use. */
const RECORD = [
  ["Proven", "A handoff the sealed AI checked, or a person reviewed and approved. Held handoffs never count."],
  ["Clean", "Proven handoffs out of all the driver's checked ones."],
  ["Pay at handover", "New drivers get 50% of a stretch's pay when the next person confirms receipt, 70% after 10 clean deliveries, 90% after 50 at 98% clean. The rest comes after delivery."],
  ["Fuel advance", "25% of the last 30 days' proven earnings, up to ₹5,000, once the record is clean."],
  ["ID checked", "A Daak operator matched the driver's government ID."],
];

/** Shops find drivers by their proven record, not by luck. The record is read from the public Hedera log. */
export default function Drivers() {
  const { data, isLoading } = useQuery<{ drivers: Driver[] }>({ queryKey: ["drivers"], queryFn: () => fetch("/api/drivers").then((r) => r.json()) });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="flex flex-col gap-4 lg:col-span-4">
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">Drivers</h1>
            <p className="text-muted-ink">Ranked by proven deliveries. Every number is computed from the public handoff log, so anyone can check it.</p>
          </header>
          <div className="rounded-xl border border-rule bg-card-paper p-5 text-sm">
            <p className="font-semibold">How the record works</p>
            <dl className="mt-3 flex flex-col gap-3">
              {RECORD.map(([t, d]) => (
                <div key={t}>
                  <dt className="font-medium">{t}</dt>
                  <dd className="text-muted-ink">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
        <section className="lg:col-span-8">
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
                <span><b className="text-base">{d.tier.advancePct}%</b> at handover</span>
              </div>
              <Button className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" onClick={() => setOpen(open === d.id ? null : d.id)}>
                {open === d.id ? "Hide record" : "See record"}
              </Button>
            </div>
            {open === d.id && (
              <div className="mt-3 flex flex-col gap-1 border-t border-rule pt-3 text-sm">
                <span>Tier: {d.tier.name} ({d.tier.advancePct}% of each stretch paid at the handover)</span>
                <span className={d.advanceReady ? "text-ok" : "text-muted-ink"}>Fuel advance: {d.advanceReady ? "unlocked by the record" : "not yet"}</span>
                <span className="text-muted-ink">What a driver earns and saves is shown only to them, in the app.</span>
                <span className="text-muted-ink">Held handoffs: {d.held}. Driver id on the public log: {d.id}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
        </section>
      </div>
    </main>
  );
}

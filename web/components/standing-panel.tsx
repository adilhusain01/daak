"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type O = { id: string; sender: string; receiver: string; drivers: string[]; daysText: string; active: boolean; lastRun: string | null; lastCode: string | null };

/** Every shop's daily orders. Vercel Cron books them at 04:00 IST; the operator can book today's now. */
export function StandingPanel() {
  const qc = useQueryClient();
  const { data } = useQuery<{ orders: O[] }>({ queryKey: ["standing"], queryFn: () => fetch("/api/standing").then((r) => r.json()) });
  const run = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/standing/run", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not run");
      return j as { due: number; booked: { id: string; code?: string; error?: string }[] };
    },
    onSuccess: (j) => {
      const ok = j.booked.filter((b) => b.code).length;
      toast.success(j.due ? `Booked ${ok} of ${j.due} daily orders for today` : "Nothing due: today's daily orders are already booked");
      qc.invalidateQueries({ queryKey: ["standing"] });
      qc.invalidateQueries({ queryKey: ["ops-list"] }); qc.invalidateQueries({ queryKey: ["ops-parcel"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const pause = useMutation({
    mutationFn: async (o: O) => {
      const r = await fetch(`/api/standing/${o.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !o.active }) });
      if (!r.ok) throw new Error("Could not change it");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["standing"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  if (!orders.length) return null;
  return (
    <section className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Daily orders ({orders.filter((o) => o.active).length} active)</h2>
          <p className="text-sm text-muted-ink">Booked and paid by each shop&apos;s agent at 4 am. The shop taps that day&apos;s parcel to attach it.</p>
        </div>
        <Button className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Booking..." : "Book today's now"}
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-rule p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{o.sender} to {o.receiver}</p>
              <p className="truncate text-muted-ink">{o.daysText} · {o.drivers.join(", ")} · {o.lastCode ? `last ${o.lastCode} on ${o.lastRun}` : "not booked yet"}</p>
            </div>
            <Button variant="outline" className="shrink-0 rounded-lg shadow-sm active:translate-y-px" disabled={pause.isPending} onClick={() => pause.mutate(o)}>
              {o.active ? "Pause" : "Resume"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

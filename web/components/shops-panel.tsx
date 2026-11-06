"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProofButton } from "@/components/site-nav";

type Shop = { uid: string; name: string; stand: string | null; account: string; rupees: number };

/** Shops' prepaid balances. A shop pays Daak by UPI; the operator enters the amount and the UTR to credit it. */
export function ShopsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery<{ shops: Shop[] }>({ queryKey: ["shops"], queryFn: () => fetch("/api/shops").then((r) => r.json()) });
  const [form, setForm] = useState<Record<string, { rupees: string; utr: string }>>({});
  const topUp = useMutation({
    mutationFn: async (uid: string) => {
      const f = form[uid] ?? { rupees: "", utr: "" };
      const r = await fetch(`/api/shop/${encodeURIComponent(uid)}/topup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rupees: Number(f.rupees), utr: f.utr }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not top up");
      return j as { rupees: number };
    },
    onSuccess: (j, uid) => { toast.success(`Credited ₹${j.rupees} to the shop's balance, UTR on the public log`); setForm((f) => ({ ...f, [uid]: { rupees: "", utr: "" } })); qc.invalidateQueries({ queryKey: ["shops"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const shops = data?.shops ?? [];
  if (!shops.length) return null;
  const set = (uid: string, k: "rupees" | "utr", v: string) => setForm((f) => ({ ...f, [uid]: { ...(f[uid] ?? { rupees: "", utr: "" }), [k]: v } }));
  const field = "min-w-0 rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink";
  return (
    <section className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Shop balances</h2>
      <p className="text-sm text-muted-ink">Each shop&apos;s agent pays bookings from its own prepaid rupees over x402. When a shop pays Daak by UPI, enter the amount and the UTR to credit it.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {shops.map((s) => (
          <li key={s.uid} className="flex flex-col gap-2 rounded-lg border border-rule p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-ink">{s.stand ?? "No stand"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className={`text-xl font-semibold tabular-nums ${s.rupees < 250 ? "text-held" : ""}`}>₹{s.rupees.toFixed(2)}</p>
                <ProofButton href={`https://hashscan.io/testnet/account/${s.account}`}>Agent account</ProofButton>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input className={`${field} w-24 shrink-0`} inputMode="decimal" placeholder="₹ amount" aria-label="Amount in rupees" value={form[s.uid]?.rupees ?? ""} onChange={(e) => set(s.uid, "rupees", e.target.value)} />
              <input className={`${field} flex-1`} placeholder="UTR from the UPI payment" aria-label="UTR" value={form[s.uid]?.utr ?? ""} onChange={(e) => set(s.uid, "utr", e.target.value)} />
              <Button className="shrink-0 rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" disabled={topUp.isPending} onClick={() => topUp.mutate(s.uid)}>Credit</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

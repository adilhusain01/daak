"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProofButton } from "@/components/site-nav";
import { when } from "@/lib/ui";

type K = { uid: string; name: string; vehicle: string; status: string; idType: string | null; last4: string | null; at: number | null };

/** Drivers whose government ID waits for a person to look at it. Shows only the ID type and last 4; the photo opens on demand. */
export function KycReview() {
  const qc = useQueryClient();
  const { data } = useQuery<{ drivers: K[] }>({ queryKey: ["kyc"], queryFn: () => fetch("/api/kyc").then((r) => r.json()) });
  const decide = useMutation({
    mutationFn: async (v: { uid: string; status: "verified" | "rejected" }) => {
      const r = await fetch("/api/kyc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, reviewer: "operator" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save");
      return j;
    },
    onSuccess: (_j, v) => { toast.success(v.status === "verified" ? "ID verified, on the public log" : "ID rejected; the driver is asked to send it again"); qc.invalidateQueries({ queryKey: ["kyc"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const pending = data?.drivers.filter((d) => d.status === "pending") ?? [];
  if (!pending.length) return null;
  return (
    <section className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Driver ID checks ({pending.length})</h2>
      <p className="text-sm text-muted-ink">Open the photo, match the name and the last 4 characters, then decide. Only the last 4 are kept.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {pending.map((d) => (
          <li key={d.uid} className="flex flex-col gap-2 rounded-lg border border-rule p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{d.name}</p>
              <p className="text-muted-ink">{d.vehicle} · {d.idType} ending {d.last4}{d.at ? ` · sent ${when(d.at)}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ProofButton href={`/api/kyc/${encodeURIComponent(d.uid)}`}>View ID photo</ProofButton>
              <Button className="rounded-lg bg-ok text-paper shadow-sm active:translate-y-px" disabled={decide.isPending} onClick={() => decide.mutate({ uid: d.uid, status: "verified" })}>Verify</Button>
              <Button variant="outline" className="rounded-lg border-held text-held shadow-sm active:translate-y-px" disabled={decide.isPending} onClick={() => decide.mutate({ uid: d.uid, status: "rejected" })}>Reject</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProofButton } from "@/components/site-nav";
import { when } from "@/lib/ui";
import { useState } from "react";

type Reading = {
  read: { docType: string; name: string; last4: string; vehicleClasses: string };
  notes: string; requestId?: string; sealed?: boolean; model?: string;
  checks: { typeOk: boolean; nameOk: boolean; last4Ok: boolean; busOk: boolean | null; maskOk: boolean | null; editedOk: boolean };
};

const CHECKS: [keyof Reading["checks"], string][] = [["typeOk", "ID type"], ["nameOk", "Name"], ["last4Ok", "Last 4"], ["busOk", "Bus licence class"], ["maskOk", "Aadhaar masked"], ["editedOk", "Not edited"]];

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
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const read = useMutation({
    mutationFn: async (uid: string) => {
      const r = await fetch(`/api/kyc/${encodeURIComponent(uid)}/read`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "0G could not read it");
      return j as Reading;
    },
    onSuccess: (j, uid) => setReadings((x) => ({ ...x, [uid]: j })),
    onError: (e) => toast.error((e as Error).message),
  });
  const pending = data?.drivers?.filter((d) => d.status === "pending") ?? [];
  if (!pending.length) return null;
  return (
    <section className="border-t border-rule pt-6">
      <h2 className="font-display text-2xl font-semibold">Driver ID checks ({pending.length})</h2>
      <p className="mt-1 text-sm text-soft-ink">Ask 0G to read the photo in a sealed machine, check it yourself, then decide. Only the last 4 characters are kept.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {pending.map((d) => (
          <li key={d.uid} className="flex flex-col gap-2 rounded-[10px] bg-card-paper p-4 shadow-[inset_0_0_0_1px_var(--color-rule)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{d.name}</p>
              <p className="text-muted-ink">{d.vehicle} · {d.idType} ending {d.last4}{d.at ? ` · sent ${when(d.at)}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ProofButton href={`/api/kyc/${encodeURIComponent(d.uid)}`}>View ID photo</ProofButton>
              <Button variant="outline" className="rounded-lg shadow-[var(--shadow-key)] active:translate-y-px" disabled={read.isPending} onClick={() => read.mutate(d.uid)}>
                {read.isPending && read.variables === d.uid ? "Reading…" : "Ask 0G to read it"}
              </Button>
              <Button className="rounded-lg bg-ok text-paper shadow-[var(--shadow-key)] active:translate-y-px" disabled={decide.isPending} onClick={() => decide.mutate({ uid: d.uid, status: "verified" })}>Verify</Button>
              <Button variant="outline" className="rounded-lg border-held text-held shadow-[var(--shadow-key)] active:translate-y-px" disabled={decide.isPending} onClick={() => decide.mutate({ uid: d.uid, status: "rejected" })}>Reject</Button>
            </div>
            {readings[d.uid] && (() => {
              const r = readings[d.uid];
              return (
                <div className="basis-full rounded-lg bg-rule/35 p-3 text-sm">
                  <p><span className="font-medium">{r.sealed === false ? "Backup model read (Cloudflare, not sealed):" : "0G read:"}</span> {r.read.name || "no name"}, ending {r.read.last4 || "?"}{r.read.vehicleClasses ? `, classes ${r.read.vehicleClasses}` : ""}. <span className="text-muted-ink">{r.notes}</span></p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {CHECKS.filter(([k]) => r.checks[k] !== null).map(([k, label]) => (
                      <span key={k} className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.checks[k] ? "bg-ok/15 text-ok" : "bg-held/15 text-held"}`}>{r.checks[k] ? "Matches" : "Check"}: {label}</span>
                    ))}
                  </p>
                  {r.requestId && <p className="mt-2 text-xs text-muted-ink" title={r.requestId}>Sealed 0G check {r.requestId.replace(/^chatcmpl-/, "").slice(0, 8)}, receipt on the public log</p>}
                </div>
              );
            })()}
          </li>
        ))}
      </ul>
    </section>
  );
}

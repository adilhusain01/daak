"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Busy, Loader } from "@/components/loader";

type Target = { hop: number; account: string; name: string; vpa: string | null; rupees: number; utr: string | null };

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 264, color: { dark: "#1c1a14", light: "#ece5d3" } }).then(setSrc); }, [text]);
  return src ? <img src={src} alt="UPI payment QR code" width={132} height={132} className="size-[132px] rounded-[6px]" /> : <span className="size-[132px] rounded-[6px] bg-tray" />;
}

/** Pay each driver of a delivered parcel by UPI, then record the bank's reference on the public log. */
export function UpiPay({ code }: { code: string }) {
  const qc = useQueryClient();
  const { data } = useQuery<{ drivers: Target[] }>({ queryKey: ["upi", code], queryFn: () => fetch(`/api/upi?code=${code}`).then((r) => r.json()), refetchInterval: false });
  const [utr, setUtr] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async (d: Target) => {
      const r = await fetch("/api/upi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, account: d.account, rupees: d.rupees, utr: (utr[d.account] ?? "").trim() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not record");
      return j;
    },
    onSuccess: () => { toast.success("UTR recorded on the public log"); qc.invalidateQueries({ queryKey: ["upi", code] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!data) return <Loader label="Loading drivers" className="min-h-32" />;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {data.drivers.map((d) => {
        const first = d.name.split(",")[0];
        return (
          <div key={d.account} className="flex gap-4 rounded-[10px] bg-card-paper p-2 shadow-[inset_0_0_0_1px_var(--color-rule)]">
            {d.vpa && !d.utr && d.rupees > 0 && (
              <div className="shrink-0 rounded-[8px] bg-paper p-1 shadow-[inset_0_0_0_1px_var(--color-rule)]">
                <Qr text={`upi://pay?pa=${encodeURIComponent(d.vpa)}&pn=${encodeURIComponent(first)}&am=${d.rupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Daak ${code}`)}`} />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 pr-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-semibold">{first}</p>
                <p className="font-mono text-lg tabular-nums">₹{d.rupees.toFixed(2)}</p>
              </div>
              {d.utr ? (
                <p className="text-sm text-ok">Paid by UPI · UTR {d.utr}</p>
              ) : !d.vpa ? (
                <p className="text-sm text-muted-ink">No UPI ID on file for this driver.</p>
              ) : d.rupees <= 0 ? (
                <p className="text-sm text-muted-ink">Nothing to pay yet. This driver is paid after their handover.</p>
              ) : (
                <>
                  <p className="truncate text-xs text-muted-ink">Scan with any UPI app to pay <span className="font-mono text-ink">{d.vpa}</span></p>
                  <label className="mt-auto text-xs text-muted-ink" htmlFor={`utr-${d.account}`}>UPI reference (UTR) after paying</label>
                  <div className="flex gap-2">
                    <input id={`utr-${d.account}`} value={utr[d.account] ?? ""} onChange={(e) => setUtr({ ...utr, [d.account]: e.target.value })} inputMode="numeric" placeholder="12-digit UTR"
                      className="h-9 min-w-0 flex-1 rounded-[6px] bg-paper px-2.5 font-mono text-sm shadow-[inset_0_0_0_1px_var(--color-rule)] outline-none placeholder:text-muted-ink focus-visible:ring-2 focus-visible:ring-ink" />
                    <Button size="sm" className="h-9 rounded-[6px] bg-ink px-3 text-paper shadow-[var(--shadow-key)] active:translate-y-px" disabled={save.isPending || !(utr[d.account] ?? "").trim()} onClick={() => save.mutate(d)}>
                      <Busy busy={save.isPending && save.variables?.account === d.account}>Record</Busy>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

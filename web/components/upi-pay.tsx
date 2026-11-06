"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/loader";

type Target = { hop: number; account: string; name: string; vpa: string | null; rupees: number; utr: string | null };

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 180, color: { dark: "#1c1a14", light: "#ece5d3" } }).then(setSrc); }, [text]);
  return src ? <img src={src} alt="UPI payment QR code" width={180} height={180} className="rounded-lg border border-rule" /> : null;
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
    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {data.drivers.map((d) => (
        <div key={d.account} className="flex flex-col gap-2 rounded-lg border border-rule bg-card-paper p-3">
          <p className="font-medium">{d.name.split(",")[0]} · ₹{d.rupees.toFixed(2)}</p>
          {d.utr ? (
            <p className="text-sm text-ok">Paid by UPI · UTR {d.utr}</p>
          ) : d.vpa ? (
            <>
              <Qr text={`upi://pay?pa=${encodeURIComponent(d.vpa)}&pn=${encodeURIComponent(d.name.split(",")[0])}&am=${d.rupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Daak ${code}`)}`} />
              <p className="text-xs text-muted-ink">Scan with any UPI app to pay {d.vpa}</p>
              <label className="text-xs text-muted-ink" htmlFor={`utr-${d.account}`}>UPI reference (UTR) after paying</label>
              <div className="flex gap-2">
                <input id={`utr-${d.account}`} value={utr[d.account] ?? ""} onChange={(e) => setUtr({ ...utr, [d.account]: e.target.value })} inputMode="numeric"
                  className="min-w-0 flex-1 rounded-md border border-rule bg-paper px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink" />
                <Button size="sm" className="rounded-md bg-ink text-paper shadow-[var(--shadow-key)]" disabled={save.isPending} onClick={() => save.mutate(d)}>Record</Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-ink">No UPI ID on file for this driver.</p>
          )}
        </div>
      ))}
    </div>
  );
}

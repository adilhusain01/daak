"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** The operator signs in once on this device; the passcode lives in the team's secrets, never in the page. */
export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: code }) });
    setBusy(false);
    if (r.ok) router.replace("/ops"); else setError("That passcode is not right.");
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4">
      <h1 className="text-3xl font-semibold tracking-tight">Daak operations</h1>
      <p className="mt-1 text-muted-ink">Deliveries, disputes and payouts. Sign in with the team passcode.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label htmlFor="passcode" className="text-sm text-muted-ink">Passcode</label>
        <input id="passcode" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)}
          className="rounded-xl border border-rule bg-card-paper px-4 py-3 text-lg outline-none focus-visible:ring-2 focus-visible:ring-ink" />
        {error && <p className="text-sm text-held" role="alert">{error}</p>}
        <Button type="submit" disabled={busy || !code} className="h-12 rounded-xl bg-ink text-paper shadow-sm active:translate-y-px">{busy ? "Checking..." : "Sign in"}</Button>
      </form>
    </main>
  );
}

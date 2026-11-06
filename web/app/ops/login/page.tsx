"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DaakMark } from "@/components/daak-mark";
import { Busy } from "@/components/loader";

/** The operator signs in once on this device; the passcode lives in the team's secrets, never in the page. */
export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: code.trim() }) });
    setBusy(false);
    // Say what the server said: a wrong passcode and a 15-minute lockout after 5 tries read differently.
    if (r.ok) router.replace("/ops");
    else setError(r.status === 429 ? "Too many wrong tries. Wait 15 minutes, then try again." : "That passcode is not right.");
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4">
      <DaakMark className="mb-6 size-12 rounded-[10px]" />
      <h1 className="font-display text-4xl font-semibold tracking-tight">Operator sign-in</h1>
      <p className="mt-2 text-soft-ink">Deliveries, disputes and payouts.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <label htmlFor="passcode" className="text-sm text-muted-ink">Passcode</label>
        <input id="passcode" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)}
          className="rounded-[10px] bg-card-paper px-4 py-3 text-lg shadow-[inset_0_0_0_1.5px_var(--color-rule)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-ink)]" />
        {error && <p className="text-sm text-held" role="alert">{error}</p>}
        <Button type="submit" disabled={busy || !code} className="h-12 rounded-[10px] bg-ink text-base font-bold text-paper shadow-[var(--shadow-key)] active:translate-y-px"><Busy busy={busy}>Sign in</Busy></Button>
      </form>
    </main>
  );
}

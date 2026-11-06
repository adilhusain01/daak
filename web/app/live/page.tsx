"use client";

import { Suspense, useState } from "react";
import { SiteNav, ProofButton } from "@/components/site-nav";
import { ParcelList, type Chain } from "@/components/parcel-list";

/** The public list of every delivery, a page at a time; open one for its stops, money and proofs. */
export default function Live() {
  const [chain, setChain] = useState<Chain | null>(null);
  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <div className="mb-6 grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
        <header className="flex flex-col gap-1 lg:col-span-8">
          <h1 className="text-3xl font-semibold tracking-tight">Live deliveries</h1>
          <p className="max-w-3xl text-muted-ink">
            Every delivery on Daak, read from Arkiv and the public Hedera log. Open one to see each stop&apos;s check, what each driver was paid at the handover and what is held until delivery.
            Photos, phone numbers and payment details stay private.
          </p>
        </header>
        {chain?.topicId && (
          <div className="flex flex-wrap gap-2 lg:col-span-4 lg:justify-end">
            <ProofButton href={`https://hashscan.io/testnet/topic/${chain.topicId}`}>Public handoff log</ProofButton>
            {chain.feeTokenId && <ProofButton href={`https://hashscan.io/testnet/token/${chain.feeTokenId}`}>Rupee credit token</ProofButton>}
            {chain.escrowId && <ProofButton href={`https://hashscan.io/testnet/account/${chain.escrowId}`}>Escrow</ProofButton>}
          </div>
        )}
      </div>
      <Suspense>
        <ParcelList endpoint="/api/live" queryKey="live-list" refetchMs={20000} hrefFor={(code) => `/live/${code}`} onChain={setChain}
          tabs={[{ id: "all", label: "All deliveries" }, { id: "transit", label: "On the way" }, { id: "paid", label: "Delivered" }]} />
      </Suspense>
    </main>
  );
}

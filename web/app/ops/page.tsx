"use client";

import { Suspense, useState } from "react";
import { SiteNav, ProofButton } from "@/components/site-nav";
import { ParcelList, type Chain } from "@/components/parcel-list";
import { KycReview } from "@/components/kyc-review";
import { AssistantPanel } from "@/components/assistant-panel";
import { StandingPanel } from "@/components/standing-panel";
import { ShopsPanel } from "@/components/shops-panel";

/** The operator's desk: every parcel a page at a time (open one to act on it), then people, daily orders and shops. */
export default function Dashboard() {
  const [chain, setChain] = useState<Chain | null>(null);
  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-muted-ink">Every parcel, every handoff, every rupee owed to the drivers who carried it. Open a parcel to see its proofs and act on it.</p>
      </header>

      <Suspense>
        <ParcelList endpoint="/api/consignments" queryKey="ops-list" hrefFor={(code) => `/ops/${code}`} onChain={setChain}
          tabs={[{ id: "all", label: "All deliveries" }, { id: "attention", label: "Need you" }, { id: "transit", label: "On the way" }, { id: "paid", label: "Paid out" }]} />
      </Suspense>

      <div className="mt-8 flex flex-col gap-0">
        <AssistantPanel />
        <KycReview />
        <StandingPanel />
        <ShopsPanel />
      </div>

      {chain?.topicId && (
        <footer className="mt-10 flex flex-wrap gap-2">
          <ProofButton href={`https://hashscan.io/testnet/topic/${chain.topicId}`}>Open the public handoff log</ProofButton>
          {chain.feeTokenId && <ProofButton href={`https://hashscan.io/testnet/token/${chain.feeTokenId}`}>Open the rupee credit token</ProofButton>}
          {chain.escrowId && <ProofButton href={`https://hashscan.io/testnet/account/${chain.escrowId}`}>Open escrow</ProofButton>}
        </footer>
      )}
    </main>
  );
}

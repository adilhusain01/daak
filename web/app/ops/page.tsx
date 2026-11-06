"use client";

import { Suspense, useState } from "react";
import { SiteNav, ProofButton, PageHead } from "@/components/site-nav";
import { ParcelList, type Chain } from "@/components/parcel-list";
import { KycReview } from "@/components/kyc-review";
import { AssistantChat } from "@/components/assistant-panel";
import { StandingPanel } from "@/components/standing-panel";
import { ShopsPanel } from "@/components/shops-panel";

/** The operator's desk: every parcel a page at a time (open one to act on it), then people, daily orders and shops. */
export default function Dashboard() {
  const [chain, setChain] = useState<Chain | null>(null);
  return (
    <main className="w-full px-5 py-8 sm:px-8 lg:px-16 xl:px-20">
      <SiteNav />
      <PageHead title="Deliveries" line="Every parcel, every handoff, every rupee owed. Open one to act on it.">
        {chain?.topicId && <>
          <ProofButton href={`https://hashscan.io/testnet/topic/${chain.topicId}`}>Public handoff log</ProofButton>
          {chain.feeTokenId && <ProofButton href={`https://hashscan.io/testnet/token/${chain.feeTokenId}`}>Rupee credit token</ProofButton>}
          {chain.escrowId && <ProofButton href={`https://hashscan.io/testnet/account/${chain.escrowId}`}>Escrow</ProofButton>}
        </>}
      </PageHead>

      <Suspense>
        <ParcelList endpoint="/api/consignments" queryKey="ops-list" hrefFor={(code) => `/ops/${code}`} onChain={setChain}
          tabs={[{ id: "all", label: "All deliveries" }, { id: "attention", label: "Need you" }, { id: "transit", label: "On the way" }, { id: "paid", label: "Paid out" }]} />
      </Suspense>

      <div className="mt-16 grid grid-cols-1 items-start gap-x-12 gap-y-14 lg:grid-cols-2">
        <KycReview />
        <StandingPanel />
        <ShopsPanel />
      </div>
      <AssistantChat />
    </main>
  );
}
